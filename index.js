#!/usr/bin/env node

'use strict';

let path = require('path');
let fs = require('fs');
let yaml = require('js-yaml');
let uuid = require('uuid');
let clc = require('cli-color');
let md = require('markdown-it')({
  html: true
});
let cheerio = require('cheerio');

// default color messages
let logError = clc.red.bold;
let logWarn = clc.yellow;
let logNotice = clc.blue;
let logSuccess = clc.green;

class JekyllToGhost {

    /**
     * Responsible to startup the class
     * @param pathPosts [path where jekyll posts are stored]
     * @method constructor
     */
    constructor (pathPosts) {
        this.errors = 0;
        this.folder = pathPosts;
        this.ghostFileOutput = './ghost-generated.json';
        this.imageReport = './image-report.txt';
        this.tags = [];
        this.ghostObj = {
            data: {
                posts: [],
                tags: [],
                posts_tags: []
            }
        };

        this.populateGhostData();
    }

    /**
     * Call methods to populate data format
     * @method populateGhostData
     */
    populateGhostData () {
        this.populateMeta();
        this.readPosts();
    }

    /**
     * Extract content from markdown post
     * create post json object
     * @method readPosts
     */
    readPosts () {
        let post;
        let postName; 
        let postDate; 
        let postPath;
        let postContent;
        let postYAML; 
        let postTitle;
        let postMarkdown;
        let cleanedMarkdown;
        let generatedHtml;
        let newHtml;
        let mobiledoc;
        let data;
        let folder = this.folder;
        let re = /(\.md|\.markdown)$/i;

        if ( ! fs.existsSync(folder) ) {
            console.log( logWarn(`Folder > ${folder} < does not exists.`) );
            console.log( logWarn('Make sure to enter the right path to jekyll folder containing the markdown files.') );

            return false;
        }

        fs.readdir(folder, (error, files) => {
            if ( error || files.length < 1 ) {
                console.log( logWarn(`Cant read files at ${folder}`) );
                return;
            }

            for ( let i = 0; i < files.length; i++ ) {
                let postObj = {};
                post = files[i];
                postPath = path.join(folder, post);

                if ( ! re.exec(post) ) {
                    console.log( logWarn(`Something went wrong reading post ${post}`) );
                    continue;
                }

                postName = this.extractPostName(post);
                postDate = this.extractPostDate(post);

                data = fs.readFileSync(postPath);

                if ( ! data ) {
                    console.log( logWarn(`Something went wrong reading post ${post}`) );
                    return;
                }

                postContent = data.toString();
                postYAML = this.extractPostYAML(postContent);
                postMarkdown = this.extractPostMarkdown(postContent);
                cleanedMarkdown = this.removeLiquidTags(postMarkdown);
                generatedHtml = md.render(cleanedMarkdown);

                if (!postYAML.title) {
                    postTitle = null;
                } else {
                    postTitle = postYAML.title;
                }

                if (postYAML.subtitle) {
                    if (postTitle !== null) {
                        postTitle = postTitle + ", " + postYAML.subtitle;
                    } else {
                        postTitle = postYAML.subtitle;
                    }
                }

                if (postTitle === null) {
                    console.log(logError(`Ghost requires a title. Could not find 'title' or 'subtitle' in YAML front matter of post ${post}.`));
                    this.errors++;
                }

                newHtml = this.fixImgTags(generatedHtml, postDate, postTitle);

                mobiledoc = JSON.stringify({
                    version: '0.3.1',
                    markups: [],
                    atoms: [],
                    cards: [['html', {cardName: 'html', html: newHtml}]],
                    sections: [[10, 0]]
                });

                postObj['id'] = i;
                postObj['uuid'] = uuid.v4();
                postObj['title'] = postTitle;
                postObj['slug'] = postName;
                postObj['mobiledoc'] = mobiledoc;
                postObj['image'] = null;
                postObj['featured'] = 0;
                postObj['page'] = 0;
                postObj['status'] = 'published';
                postObj['language'] = 'en_US';
                postObj['meta_title'] = postTitle;
                postObj['meta_description'] = null;
                postObj['author_id'] = 1;
                postObj['created_at'] = Date.parse(postDate);
                postObj['created_by'] = 1;
                postObj['updated_at'] = Date.parse(postDate);
                postObj['updated_by'] = 1;
                postObj['published_at'] = Date.parse(postDate);
                postObj['published_by'] = 1;

                this.populatePosts(postObj);

                this.populateTags(postYAML.tags, i);

                if ( (this.ghostObj.data.posts.length + 1) === files.length) {
                    this.finish();
                }
            }
        });
    }

    /**
     * Extract date from post
     * @param content [post content]
     * @returns {string}
     * @method extractPostDate
     */
    extractPostDate (content) {
        return content.substring(0, 10)
    }

    /**
     * Extract name post
     * @param content [post content]
     * @returns {string}
     * @method extractPostName
     */
    extractPostName (content) {
        return content.substring(11, content.indexOf('.'));
    }

    /**
     * Extract post YAML header information
     * @param content [post content]
     * @returns {yaml}
     * @method extractPostYAML
     */
    extractPostYAML (content) {
        return yaml.safeLoad( content.substring(0, content.indexOf('---', content.indexOf('---') + 1) ));
    }

    /**
     * Extract post markdown content
     * @param content [post content]
     * @returns {string}
     * @method extractPostMarkdown
     */
    extractPostMarkdown (content) {
        return content.substring(content.lastIndexOf('---') + 3, content.length);
    }

    /**
     * Remove Liquid {% %} and {{ }} tags from Markdown
     * @param content [post content]
     * @returns {string}
     * @method removeLiquidTags
     */
    removeLiquidTags(content) {
        const liquidTag = /{%\-?[\w\sÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ=!<>.'",:()\-]+\-?%}/g;
        const liquidOutput = /{{[\w\sÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ.'",;:|%\[\]\-]+}}/g;

        let output = content.replace(liquidTag, "");
        output = output.replace(liquidOutput, "");

        return output;
    }

    /**
     * Replace the `src` value in <img> tags with '/content/<post year>/<post month>/<image file>'.
     * @param html
     * @param postDate
     * @param postTitle
     * @returns {string}
     * @method fixImgSrcTags
     */
    fixImgTags(html, postDate, postTitle) {
        // Construct the content path from the post year and post month
        let contentPath = '/content/images/' + postDate.substring(0, 4) + '/' + postDate.substring(5, 7) + '/';

        // Parse the HTML with Cheerio
        let $ = cheerio.load(html);

        // For each <img> tag, get the `src` value and take the string from the last slash
        // to the end as `imageFile`. If `src` contains no slashes, use the whole `src` value as `imageFile`.
        // Then set `src` to `contentPath` + `imageFile`.
        let images = [];
        $('img').each(function(i, elem) {
            let imageFile;
            let src = $(this).attr('src');
            let lastSlash = src.lastIndexOf('/');
        
            if (lastSlash !== -1) {
                imageFile = src.substring(lastSlash + 1);
            } else {
                imageFile = src;
            }

            images.push(imageFile);
        
            let newSrc = contentPath + imageFile;
            $(this).attr('src', newSrc);
        });

        if (images.length > 0) {
            if (images.filter(item => item.length > 0).length === 0) {
                // We found <img> tags but couldn't find file names in the `src` attribute.
                fs.appendFileSync(this.imageReport, `WARNING: The post "${postTitle}" contains <img> tags, but the image file names could not be determined. Please fix the <img> tags and copy the images to ${contentPath}.\n`, 'utf8');
            } else {
                // We found the file names and updated the <img> tags.
                fs.appendFileSync(this.imageReport, `<img> tags have been updated for "${postTitle}." Copy the following images to ${contentPath}:\n`, 'utf8');
                fs.appendFileSync(this.imageReport, images.join('\n'), 'utf8');
            }

            fs.appendFileSync(this.imageReport, '\n=============================\n\n', 'utf8');
        }

        return $('body').html();
    }

    /**
     * Populate meta obj
     * @method populateMeta
     */
    populateMeta () {
        this.ghostObj['meta'] = {
            'exported_on': Date.now(),
            'version': '3.32.2'
        }
    }

    /**
     * Populate posts Array with post obj
     * @param  postObj [post obj formatted]
     * @method populatePosts
     */
    populatePosts (postObj) {
        this.ghostObj['data']['posts'].push(postObj);
    }

    /**
     * Populate tags Array with tag. Populate posts_tags Array with post and tag.
     * @param tags
     * @param postId
     * @method populateTags
     */
    populateTags (tags, postId) {
        for (let tag of tags) {
            // Replace dashes with spaces.
            tag = tag.replace('-', ' ');

            if (this.tags.indexOf(tag) === -1) {
                // The tag needs to be added to `this.tags`
                // and the output `tags` array.
                this.tags.push(tag);
    
                let tagData = {
                    id: this.tags.indexOf(tag),
                    name: tag
                }
    
                this.ghostObj['data']['tags'].push(tagData);
            }

            // Add the `postTag` object to the output `posts_tags` array.
            let postTag = {
                tag_id: this.tags.indexOf(tag),
                post_id: postId
            }

            this.ghostObj['data']['posts_tags'].push(postTag);
        }
    }

    /**
     * Parse js obj to json string format
     * @method ghostToJson
     */
    ghostToJson () {
        return JSON.stringify(this.ghostObj)
    }

    /**
     * Write json data to file
     * @method writeToFile
     */
    writeToFile () {
        let data = this.ghostToJson();

        fs.writeFileSync(this.ghostFileOutput, data, 'utf8');
        console.log( logSuccess('Ghost JSON generated successfully!') );
    }

    /**
     * Finish handler
     * @method finish
     */
    finish () {
        if (this.errors === 0) {
            this.writeToFile();
        } else {
            console.log(logError('JSON could not be generated due to errors.'));
        }
    }

}


/**
 * Get the user input (folder name) and instantiate JekyllToGhost
 * passing the path of the folder
 */
console.log( logSuccess('Running...') );

if ( process.argv[2] ) {
  let app = new JekyllToGhost(process.argv[2]);
} else if ( process.argv.length === 1 ) {
    console.log( logWarn('You need to specify a path to Jekyll posts.') );
}

module.exports = JekyllToGhost;
