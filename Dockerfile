
FROM node:14.15.5-alpine

WORKDIR /client

# RUN mkdir frontend

# RUN ls -lart

# RUN pwd

COPY /client/package.json .
COPY /client/package-lock.json .

# RUN cd /frontend

RUN npm install -g @angular/cli@12.0.1
RUN npm install

# RUN cd ..

COPY /client/. .

RUN export NODE_OPTIONS=--openssl-legacy-provider
# RUN cd /frontend
RUN npm run build

# RUN pwd

# RUN ls -lart

# RUN cd ..

# RUN mkdir backend

WORKDIR /backend

COPY /backend/package.json .
COPY /backend/package-lock.json .

RUN npm install

COPY /backend/. .

RUN pwd

RUN cp -R /client/dist/client /backend/public/.

RUN npm install pm2 -g

EXPOSE 3003

ENTRYPOINT npm run start