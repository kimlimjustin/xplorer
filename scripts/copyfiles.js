const cpy = require('cpy');
const process = require('process');

(async () => {
    await cpy(['src/**/*', '!src/**/*.ts', 'lib/**/*', 'build/**/*'], 'outs', {
        parents: true,
    });
})();
