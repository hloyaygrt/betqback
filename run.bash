set -e

sudo apt-get update --fix-missing
sudo apt-get install nodejs
sudo apt-get install npm

npm i
node app.js
