module.exports = {
  name: 'node',
  build: 'npm i',
  apps: [{
    name: 'js-app',
    script: 'js-app.js'
  }, {
    name: 'ts-app',
    script: 'npx',
    args: 'ts-node ts-app.ts'
  }],
  migrations: {
    // This executes second. Migrations are ordered by key before they run.
    '2020-07-16-file': 'npx ts-node-script bbox/migrations/2020-07-16-file.ts',
    // This executes first.
    '2020-07-15-function': async (opts) => {
      console.log('Mig2'); // XXX
    },
  }
}
