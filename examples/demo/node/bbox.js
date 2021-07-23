module.exports = {
  name: 'node',
  docker: {
    file: 'Dockerfile'
  },
  services: {
    'js-app': {
      start: 'node js-app.js',
      dependencies: [
        { pipeline: 'build' },
        { pipeline: 'configure' }
      ]
    },
    'ts-app': {
      start: 'npx ts-node ts-app.ts',
      dependencies: [
        { pipeline: 'build' },
        { pipeline: 'configure' }
      ]
    }
  },
  pipelines: {
    configure: {
      steps: {
        '10CreateConfig': { task: 'createConfig' }
      }
    },
    build: {
      steps: {
        '10Build': { task: 'build' }
      }
    },
  },
  tasks: {
    createConfig: {
      run: () => {
        const fs = require('fs');
        fs.copyFileSync('config.sample.js', 'config.js');
      }
    },
    build: {
      run: 'npm i'
    }
  }
}
