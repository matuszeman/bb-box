module.exports = {
  name: 'node',
  build: 'npm i',
  services: [{
    name: 'js-app',
    start: 'node js-app.js'
  }, {
    name: 'ts-app',
    start: 'npx ts-node ts-app.ts'
  }],
  runtime: 'DockerCompose',
  migrations: {
    // This executes second. Migrations are ordered by key before they run.
    '2020-07-16-ts': 'npx ts-node-script bbox/migrations/2020-07-16.ts',
    // This executes first.
    '2020-07-15-js': 'node bbox/migrations/2020-07-15.js',
  }
}
