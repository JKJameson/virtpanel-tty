docker build --pull -t virtpanel/tty .

# Restart Container
docker rm -f vp-tty 2> /dev/null
docker run -d --name vp-tty -m 512m -v /usr/local/virtpanel/conf/tty:/tty-config --restart always virtpanel/tty
docker network connect vp-tty vp-tty
