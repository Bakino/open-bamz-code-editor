# open-bamz-code-editor
Open BamZ code editor plugin

# SSH access - server configuration

This guide is for the server side installation

The SSH access allow the user to edit the application files directly from VS Code using [remote SSH access](https://code.visualstudio.com/docs/remote/ssh)

Prepare a key pair in `ssh_keys` : 
```bash
mkdir ssh_keys
ssh-keygen -t ed25519 -f ssh_keys/id_rsa -N ""
```

You need to add the following SSH docker container in your docker compose: 
```yaml
  # container used by code editor plugin to provide ssh access
  bamz-ssh:
    build:
      context: .
      dockerfile: Dockerfile_ssh # <-- this is the provided [Dockerfile_ssh](./Dockerfile_ssh)
    hostname: bamz-ssh
    ports:
      - "2222:22" # <-- map the public port that you wish to use on your server
    volumes:
      - dev-open-bamz-data:/users:rw
      - ./ssh_keys/id_rsa.pub:/root/.ssh/authorized_keys # This key will be use to communicate between BamZ and the SSH container
    restart: always
```

And add the following variable to your BamZ container : 
```yaml
    environment:
      - ...
      - "SSH_PORT=22" # Port to connect between container (not the outside port). You should not need to modify this
      - "SSH_CONTAINER_HOST=bamz-ssh" # container name of the ssh server. You should not need to modify this
      - "SSH_ADMIN_USER=root" # User to connect to the ssh server to manage user creation. You should not need to modify this
      - "SSH_ADMIN_PRIVATE_KEY_FILE=/home/node/.ssh-bamz_id_rsa" # Path to the private key (see mapping below)
    volumes:
      - ./ssh_keys/id_rsa:/home/node/.ssh-bamz_id_rsa:ro # Private key to communicate with SSH container
```

**Note** : Le Dockerfile adjust permission in order that
 - /users (mapping of apps storage directory) belongs to 1001 and is traversable by other (but not readable by others)
 - /users/apps/XXX has setgid so file that will be created through SSH get group 1001 so the can be editable by BamZ

=> check that when connecting by SSH as a user you cannot see the content of /users/apps/ nor enter in other directory that you own app in it

# SSH access - user guide

As a user, after installed the open-bamz-code-editor plugin, go to the SSH setting page and click on "Create User". 

I suggest that you use a public key authentication too, if you don't have key yet, run : 
ssh-keygen -t ed25519

the upload the generated id_rsa.pub content.

In VS Code, install the [remote SSH access](https://code.visualstudio.com/docs/remote/ssh). Configure a host as following assuming bamzserver.bakino.fr is the server: 
```
Host USERNAME.bamzserver.bakino.fr
    HostName bamzserver.bakino.fr
    User examples
    Port 2222
```

if you added you key add :
```
    AddKeysToAgent yes
    UseKeychain yes
    IdentitiesOnly no
    IdentityFile ~/.ssh/id_rsa_bakino
```

