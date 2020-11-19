set -e

rsync -r src yura@130.193.57.125:/home/yura/betqback
rsync -r *.js yura@130.193.57.125:/home/yura/betqback
rsync -r package.json yura@130.193.57.125:/home/yura/betqback
rsync -r index.html yura@130.193.57.125:/home/yura/betqback
rsync -r *.bash yura@130.193.57.125:/home/yura/betqback
