#!/usr/bin/env python3

import sys, os, shutil, argparse, logging
def main():
    script_dir = os.path.dirname(os.path.realpath(__file__))
    image_report = os.path.join(script_dir, 'image-report.txt')

    logger = logging.getLogger(__name__)
    logger.setLevel(logging.DEBUG)
    
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    ch_formatter = logging.Formatter('%(message)s')
    ch.setFormatter(ch_formatter)
    logger.addHandler(ch)

    fh = logging.FileHandler(os.path.join(script_dir, 'copy-images.log'))
    fh.setLevel(logging.DEBUG)
    fh_formatter = logging.Formatter('%(levelname)s: %(message)s')
    fh.setFormatter(fh_formatter)
    logger.addHandler(fh)

    parser = argparse.ArgumentParser(description='Copy images from Jekyll _site directory to Ghost directory')
    parser.add_argument('jekyll_site_dir', help="The path to your generated Jekyll site (usually `_site`), e.g., '~/my-jekyll-site/_site'.")
    parser.add_argument('ghost_dir', help='The path to the top level of your Ghost site (the parent of the `content` directory).')

    args = parser.parse_args()
    ghost_dir = args.ghost_dir
    jekyll_site_dir = args.jekyll_site_dir

    logger.info('Jekyll directory: {}'.format(jekyll_site_dir))
    logger.info('Ghost directory: {}'.format(ghost_dir))

    targets = {} # This will be {<target Ghost directory>: [<list of image files>]}
    target_dir = None
    post_title = None
    post_image_files = []
    image_files_read_from_report = 0

    with open(image_report, 'r') as ir:
        logger.info('Reading {}...'.format(image_report))
        for line in ir:
            logger.debug('Line: ' + line.strip('\n'))
            if line.startswith('Post Title:'):
                post_title = line[12:].strip('\n')
            elif line.startswith('Target Directory:'):
                # Set the target directory and start reading image file names for this post.
                target_subdir = line[18:].strip('\n').strip('/')
                target_dir = os.path.join(ghost_dir, target_subdir)
                logger.debug('Target Directory: {}'.format(target_dir))
                logger.debug('Existing Target Directory: {}'.format('YES' if target_dir in targets.keys() else 'NO'))
            elif line.startswith('='):
                # We reached the end of the image files for this post.
                # If the target directory is an existing key in `targets`, extend the existing list with
                # the image file names from this post.
                # If the target directory is not an existing key, save the target directory
                # and the list of files in the `targets` dictionary.
                if target_dir not in targets.keys() and target_dir is not None:
                    targets[target_dir] = post_image_files
                elif target_dir is None:
                    pass
                else:
                    targets[target_dir].extend(post_image_files)

                # Reset the processing variables.
                target_dir = None
                post_title = None
                post_image_files = []
            elif line.startswith('WARNING') or line.startswith('<img>') or len(line.strip('\n')) == 0:
                # No action is needed for these lines.
                continue
            else:
                # Anything else is a file name we need to save.
                filename = line.strip('\n')

                if filename in post_image_files:
                    # Don't save duplicate file names in the same post. Warn the user.
                    logger.warning('Skipping duplicate file name in post "{}": {}'.format(post_title, filename))
                else:
                    logger.debug('File name: {}'.format(filename))
                    post_image_files.append(filename)
                    image_files_read_from_report += 1


    logger.info('Read {} unique image file names from {}'.format(image_files_read_from_report, image_report))
    logger.info('Searching for image files in {}...'.format(jekyll_site_dir))

    # For each key in `targets`, loop through the image files.
    # Walk the Jekyll directory to find the full path of each image.
    image_files_copied = 0
    errors = 0
    files_to_copy = {}
    source_files = []

    for t in targets.keys():
        source_files = []
        try:
            os.makedirs(t)
        except FileExistsError:
            pass
        except:
            logger.error('Could not create target directory {}'.format(t))
            errors += 1
        for root, dirs, files in os.walk(jekyll_site_dir):
            for f in files:
                if f in targets[t]:
                    logger.debug('Found image file {} in {}'.format(f, root))
                    src_file = os.path.join(root, f)
                    source_files.append(src_file)
        
        files_to_copy[t] = source_files

    # Copy the files
    logger.info('Copying image files to {}...'.format(ghost_dir))
    for target, filenames in files_to_copy.items():
        for f in filenames:
            try:
                shutil.copy(f, target)
                logger.debug('Copied {} to {}'.format(f, target))
                image_files_copied += 1
            except:
                logger.error('An error occurred while copying {} to {}'.format(f, target))
                errors += 1

    logger.info('Script finished. {} of {} files copied. {} {} occurred.'.format(image_files_copied, image_files_read_from_report, errors, 'error' if errors == 1 else 'errors'))
    logger.info('Full output is logged in {}.'.format(os.path.join(script_dir, 'copy-images.log')))
    sys.exit()
    
if __name__ == "__main__":
    main()