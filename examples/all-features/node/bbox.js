module.exports = {
  name: 'node',
  runtime: 'Local',
  configure: {
    '01-createConfig': {
      run: () => {
        //console.log(runner); // XXX
      },
      once: true
    }
  },
  build: {
    '10-build': {
      run: 'npm i'
    }
  },
  docker: {
    file: 'Dockerfile'
  },
  services: {
    'js-app': {
      start: 'node js-app.js'
    },
    'ts-app': {
      start: 'npx ts-node ts-app.ts'
    }
  }
}
