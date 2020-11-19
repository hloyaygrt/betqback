set -e

rsync -r src yura@178.154.235.122:/home/yura/betqback
rsync -r *.js yura@178.154.235.122:/home/yura/betqback
rsync -r package.json yura@178.154.235.122:/home/yura/betqback
rsync -r index.html yura@178.154.235.122:/home/yura/betqback
rsync -r *.bash yura@178.154.235.122:/home/yura/betqback
