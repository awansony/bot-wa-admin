pkg update && pkg upgrade -y 
pkg install nodejs-lts git -y 
git clone https://github.com/awansony/bot-wa-admin.git
cd bot-wa-admin 
npm install  
node index.js
