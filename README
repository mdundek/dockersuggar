# Docker Suggar

Docker Suggar is a command line tool, written in NodeJS. 
It is usefull to those who do not want to bother with complex Docker commands every time they need to use it.  

For instance when you wish to spin up a new docker container instance from an image, rather than remembering available Docker commands to bind ports, volumes, environement variables..., Docker Suggar will take you by the hand and help you run your container based on your specific image specifications.
This tool will also filter out dangeling images to keep things clear, and save previous choices when running a new container to avoid having to remember every image specific settings.

## Getting Started

This module is intended to be installed globally on your machine, it will provide you with a new command in your terminal to interact with your local Docker setup. You can also administer your Docker setup over SSH on a remote machine.

>Be aware that this is a work in progress.  
>I will add new commands and fix potential bugs as time goes by.  
>Any suggestions or requests are welcome, if you feel like participating, just do a pull request and I will gladly merge your updates if appropriate.

I am well aware that a hardcore Docker geek will not find this tool very usefull, while others will enjoy the headache free Docker experience provided by Docker Suggar.


### Prerequisites

Docker Suggar requires Docker CLI, as well as NodeJS to be installed on your machine.

> I have tested this module on OSX only, please feel free to give this a try on other operating systems.  

### Installing

```
npm install -g dockersuggar
```

Once instralled, you can use it with the commandline command `dockersuggar`.  
  
To get the list of available commands, use:

```
dockersuggar -h
```

This outputs:

```
  ____             _             ____
 |  _ \  ___   ___| | _____ _ __/ ___| _   _  __ _  __ _  __ _ _ __
 | | | |/ _ \ / __| |/ / _ \ '__\___ \| | | |/ _` |/ _` |/ _` | '__|
 | |_| | (_) | (__|   <  __/ |   ___) | |_| | (_| | (_| | (_| | |
 |____/ \___/ \___|_|\_\___|_|  |____/ \__,_|\__, |\__, |\__,_|_|
                                             |___/ |___/

  Usage: dockersuggar [options] [command]

  Options:

    -V, --version                                   output the version number
    -h, --help                                      output usage information

  Commands:

    dockerfiles|df                                  List local Dockerfiles
    new|n                                           Create a new Dockerfile
    editDockerfile|ed                               Edit dockerfile with default editor
    build|b                                         Build a docker image
    images|i                                        List docker images
    describe                                        Describe an image such as ports, volumes and environement variables
    tag|t                                           Tag a docker image for a repository
    push|p                                          Push a docker image to repository
    deleteImage|di                                  Delete a docker image
    run|r                                           Run container from image
    containers|c                                    List containers
    startContainer|startc                           Start a docker container
    stopContainer|stopc                             Stop running docker container
    deleteContainer|dc                              Delete a docker container
    inspect|i <network|image|bindings|volumes|raw>  Get container specific information
    logs|l                                          Display logs for conainer
    bash|b                                          Bash terminal into running conainer
    exec|e                                          Execute command on running conainer
```

Some commands just output the required data.  
Example - List all containers on this machine:

```
dockersuggar containers
```

Other commands will take you by the hand, and prompt you for details to get the desired outcome.  
Example - Run a new docker container:

```
dockersuggar run

1: debian (stretch-slim) - ID 3ad2120063ab, SIZE 55.3MB
2: debian (jessie) - ID 2fe79f06fa6d, SIZE 123MB
3: debian-test (1.0.0) - ID 3c7f347f1dea, SIZE 55.3MB
4: mdundek/mongo_facturation (latest) - ID 51f03b16565e, SIZE 360MB
5: mongo (latest) - ID 51f03b16565e, SIZE 360MB
6: mysql (5.7.13) - ID 1195b21c3a45, SIZE 380MB
7: r.cfcr.io/mdundek/mongo_facturation (latest) - ID 51f03b16565e, SIZE 360MB
8: registry.eu-de.bluemix.net/treeid/postgresql (9.6) - ID 247210f416d3, SIZE 271MB
9: registry.eu-de.bluemix.net/treeid/postgresqlgis (9.6) - ID 31a67e786baf, SIZE 406MB
10: registry.eu-gb.bluemix.net/garage_nice/mysql (5.7.21) - ID 59e91c2dde8b, SIZE 409MB
11: resin/rpi-raspbian (latest) - ID 0cc38b89307c, SIZE 126MB
12: tensorflow/tensorflow (latest-py3) - ID bf5d66f16f8c, SIZE 1.25GB
13: tomcat (7) - ID d10641f583b3, SIZE 456MB
14: yaha (latest) - ID 6ff76a5f9d82, SIZE 848MB

? Image to run: 6
? Container name: FooDevMysql
? Remove container on exit: Yes
? Do you want to run this container in detached mode: Yes

Port mapping:

4444:3306

? What do you wish to do (Use arrow keys)
  Add / update
  Remove
❯ Done

... // You get the point
```

It is also possible to use Docker Suggar to execute commands on a running container, or to start a bash shell session for instance:

```
dockersuggar bash

1: Up:   mongo_facturation - ID f09078f5c255, created 9 months ago (IMAGE ID 51f03b16565e -> mongo:latest)

? Container number to start a bash session in: 1

root@f09078f5c255:/# ls -l

total 72
drwxr-xr-x   2 root root 4096 Apr 24  2017 bin
drwxr-xr-x   2 root root 4096 Dec 28  2016 boot
drwxr-xr-x   4 root root 4096 May  1  2017 data
drwxr-xr-x   5 root root  340 May  2 13:19 dev
drwxr-xr-x   2 root root 4096 May  1  2017 docker-entrypoint-initdb.d
lrwxrwxrwx   1 root root   34 May  1  2017 entrypoint.sh -> usr/local/bin/docker-entrypoint.sh
drwxr-xr-x   1 root root 4096 Jul 16  2017 etc
drwxr-xr-x   2 root root 4096 Dec 28  2016 home
drwxr-xr-x   1 root root 4096 May  1  2017 lib
drwxr-xr-x   2 root root 4096 Apr 24  2017 lib64
drwxr-xr-x   2 root root 4096 Apr 24  2017 media
drwxr-xr-x   2 root root 4096 Apr 24  2017 mnt
drwxr-xr-x   2 root root 4096 Apr 24  2017 opt
dr-xr-xr-x 181 root root    0 May  2 13:19 proc
drwx------   1 root root 4096 Apr 30 13:33 root
drwxr-xr-x   3 root root 4096 Apr 24  2017 run
drwxr-xr-x   2 root root 4096 Apr 24  2017 sbin
drwxr-xr-x   2 root root 4096 Apr 24  2017 srv
dr-xr-xr-x  13 root root    0 May  2 13:19 sys
drwxrwxrwt   1 root root 4096 May  2 13:19 tmp
drwxr-xr-x   1 root root 4096 May  1  2017 usr
drwxr-xr-x   1 root root 4096 May  1  2017 var
root@f09078f5c255:/#

...
```


## Authors

* **Michael Dundek** - *Initial work*

## License

This project is licensed under the MIT License
