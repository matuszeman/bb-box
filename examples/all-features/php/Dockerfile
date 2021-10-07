FROM node:12.16.1-slim

# install system dependencies
RUN DEBIAN_FRONTEND=noninteractive apt-get update && apt-get install -y build-essential git-core python

# Create an user
## https://jtreminio.com/blog/running-docker-containers-as-current-host-user/
ARG USER_ID
ARG GROUP_ID
## USER_ID is defined && GROUP_ID is defined && user with USER_ID does not exists already
RUN if [ ${USER_ID:-0} -ne 0 ] && [ ${GROUP_ID:-0} -ne 0 ] && ![ id "$USER_ID" >/dev/null 2>&1 ]; then \
    groupadd -g ${GROUP_ID} user &&\
    useradd -l -u ${USER_ID} -g user user \
;fi
USER user
