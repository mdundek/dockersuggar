# Docker Suggar

Docker Suggar is a command line tool, written in NodeJS.   
It is usefull to those who are working with remote Docker instances and/or do not want to bother with complex Docker commands every time they need to use it.  

For instance when you wish to spin up a new docker container instance from an image, rather than remembering available Docker commands to bind ports, volumes, environement variables..., Docker Suggar will take you by the hand and help you run your container based on your specific image specifications.
You can also work directly with remote Docker deamons on your network to simplify things even further.

## Getting Started

This module is intended to be installed globally on your machine, it will provide you with a new command in your terminal to interact with your local Docker setup.

>Be aware that this is a work in progress.  
>I will add new commands and fix potential bugs as time goes by.  
>Any suggestions or requests are welcome, if you feel like participating, just do a pull request and I will gladly merge your updates if appropriate.


### Prerequisites

Docker Suggar requires NodeJS to be installed on your machine.  
If you wish to administer remote Docker instances with dockersuggar, you will have to enable the remote API on your remote Docker installation.  
The documentatiopn explaining how to do this can be found [here](https://success.docker.com/article/how-do-i-enable-the-remote-api-for-dockerd)

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

    -V, --version            output the version number
    -r, --remote <name>      Execute command on a remote docker instance
    -h, --help               output usage information

  Commands:


    Local Dockerfile stuff:

      dockerfiles | df         List local Dockerfiles
      new | n                  Create a new Dockerfile
      editDockerfile | ed      Edit dockerfile with default editor
      build | b                Build a docker image

    Docker images:

      images | i               List available docker images
      document                 Document an image such as ports, volumes and environement variables
      tag | t                  Tag a docker image for a repository
      deleteImage | di         Delete a docker image

    Containers:

      containers | c           List containers
      run | r                  Run container from image
      startContainer | startc  Start a docker container
      stopContainer | stopc    Stop running docker container
      deleteContainer | dc     Delete a docker container
      inspect [options]        Get container specific information
      logs | l                 Display logs for conainer
      shell                    Shell terminal into running conainer
      exec | e                 Execute command on running conainer

    Networks:

      networks | net           List available networks
      createNetwork | cn       Create new network
      deleteNetwork | dn       Delete a network
      inspectNetwork | in      Inspect a network
      linkToNetwork | ltn      Link a container to a network
      unlinkFromNetwork | ufn  Unlink a container from a network

    Docker remote API servers:

      listRemote               List remote connections
      addUpdateRemote          Add / Update remote docker connection
      removeRemote             Remove a remote docker connection
```




## Some examples

### Work with local Docker instances (list images): 

```
$ dockersuggar images

debian (jessie) - ID sha256:2fe79f06fa6d..., SIZE 117.70
debian (stretch-slim) - ID sha256:3ad2120063ab..., SIZE 52.72
```

### Add remote Docker configuration: 

```
$ dockersuggar addUpdateRemote

? Remote connection name: dev_docker
? Protocol: http
? Server host: 192.168.1.25
? Server port: 7654

$ dockersuggar listRemote

dev_docker (http://192.168.1.25:7654)
```

### Work with remote Docker instances: 

```
$ dockersuggar -r dev_docker <command>
```

For example, to list all images on a remote Docker instance:

```
$ dockersuggar -r dev_docker images

debian (jessie) - ID sha256:2fe79f06fa6d..., SIZE 117.70
debian (stretch-slim) - ID sha256:3ad2120063ab..., SIZE 52.72
mongo (latest) - ID sha256:51f03b16565e..., SIZE 343.07
mysql (5.7.13) - ID sha256:1195b21c3a45..., SIZE 362.61
tensorflow/tensorflow (latest-py3) - ID sha256:bf5d66f16f8c..., SIZE 1193.54
tomcat (7) - ID sha256:d10641f583b3..., SIZE 434.87
ubuntu (latest) - ID sha256:452a96d81c30..., SIZE 75.93
```

### Start a new container: 

NOTE: Once a specific image:tag has been run using `dockersuggar`, the last configuration options will be saved and used as presets values for the next time you run this image. This will make it easier to quickly run images without having to remember image specific configuration details.

```
dockersuggar run

1: debian (jessie) - ID sha256:2fe79f06fa6d..., SIZE 117.70
2: debian (stretch-slim) - ID sha256:3ad2120063ab..., SIZE 52.72
3: mongo (latest) - ID sha256:51f03b16565e..., SIZE 343.07
4: mysql (5.7.13) - ID sha256:1195b21c3a45..., SIZE 362.61
5: tensorflow/tensorflow (latest-py3) - ID sha256:bf5d66f16f8c..., SIZE 1193.54
6: tomcat (7) - ID sha256:d10641f583b3..., SIZE 434.87
7: ubuntu (latest) - ID sha256:452a96d81c30..., SIZE 75.93

? Image to run: 4
? Container name: myproject_dev_mysql
? Remove container on exit: No
? Do you want to run this container in detached mode: Yes
? Link the container to an existing network: No
? Do you wish to log into this container: No

Execute commands:

  -None-

? What do you wish to do: Done


Port mapping:

  -None-

? What do you wish to do: Add
? Container port 3306
? Host port 3307

3307:3306

? What do you wish to do: Done


Volume mapping:

  -None-

? What do you wish to do: Add
? Container volume path /var/lib/mysql
? Host volume path /my/own/datadir

/my/own/datadir:/var/lib/mysql

? What do you wish to do: Done


Environement variables:

  -None-

? What do you wish to do: Add
? Environement variable name MYSQL_ROOT_PASSWORD
? Environement variable value secret_password

MYSQL_ROOT_PASSWORD=secret_password

? What do you wish to do: Done


IMAGE: mysql:5.7.13
CONTAINER HOSTNAME: 00b4d67dfa44
CONTAINER IP: 172.17.0.2
PORT: 3306/tcp => No host mappings
BINDINGS: /var/lib/mysql => Host folder /my/own/datadir
VOLUME: /var/lib/mysql

Done
```

### Container networks: 

To create a network and have containers join those networks so that they can directly communicate with each other, you need to create the network first, then run containers and specify the network to join, or link existing containers to those networks afterwards:

```
dockersuggar createNetwork

? Network driver: bridge
? Network name: my_network

Network created

dockersuggar linkToNetwork

1: Down: /affectionate_jang - ID d5f6f9512cd2..., created Wed Apr 25 2018 10:03:52 GMT+0200 (CEST)
2: Down: /inspiring_roentgen - ID 0123099571dd..., created Wed Apr 25 2018 10:06:54 GMT+0200 (CEST)
3: Down: /nifty_bell - ID f9778f1c9598..., created Wed Apr 25 2018 10:07:13 GMT+0200 (CEST)
4: Down: /amazing_goodall - ID b42e11b942a7..., created Wed Apr 25 2018 10:16:02 GMT+0200 (CEST)
5: Up:   /myproject_dev_mysql - ID 00b4d67dfa44..., created Wed May 09 2018 11:02:32 GMT+0200 (CEST)
      (IMAGE ID sha256:1195b21c3a45... -> mysql:5.7.13)

? Container number to link to this network: 5

1: bridge, Scope: local, Driver: bridge
2: docker_default, Scope: local, Driver: bridge
3: host, Scope: local, Driver: host
4: my_network, Scope: local, Driver: bridge
5: none, Scope: local, Driver: n/a

? Network number to link a container to: 4

Done

dockersuggar inspectNetwork

1: bridge, Scope: local, Driver: bridge
2: docker_default, Scope: local, Driver: bridge
3: host, Scope: local, Driver: host
4: my_network, Scope: local, Driver: bridge

? Network number to inspect: 4

SCOPE: local
DRIVER: bridge
IMAP CONFIG: Subnet => 172.20.0.0/16, Gateway => 172.20.0.1
CONTAINERS: myproject_dev_mysql (172.20.0.2/16)
```

## Special thanks

Aside of other usefull modules used in `dockersuggar`, I want to give extra credits to a very usefull module called `dockerode`, key in creating this usefull tool. `dockerode` is the heart of the docker command engine of `dockersuggar`, providing easy access to remote docker instances. So to the author `apocas`, keep up the good work!

## Authors

* **Michael Dundek** - *Initial work*

## License

This project is licensed under the MIT License
