const fs = require('fs');
const browserify = require('browserify');

const args = process.argv.slice(2);
const release = args.find(x => x === 'release');

if (!release) {
    console.log('[x] Preparing to build ...');
    browserify('./src/roomrtc', {
            standalone: 'RoomRTC',
            debug: true
        })
        .transform('babelify', {
            presets: ['es2015']
        })
        .bundle()
        .pipe(fs.createWriteStream('dist/roomrtc.bundle.js'));
} else {
    let fileOut = fs.createWriteStream('dist/roomrtc.min.js');
    let pks = fs.readFileSync('package.json');
    let pkg = JSON.parse(pks);

    console.log(`[x] Preparing to release: roomrtc-v${pkg.version} ...`);

    browserify('./src/roomrtc', {
            standalone: 'RoomRTC',
            debug: false
        })
        .transform('babelify', {
            presets: ['es2015']
        })
        .transform('uglifyify', {
            sourcemap: false,
            global: true
        })
        .bundle()
        .pipe(fileOut);

    fileOut.on('finish', () => {
        console.log('[x] Update bower version:', pkg.version);
        let bower = JSON.parse(fs.readFileSync('bower.json'));
        bower.version = pkg.version;
        fs.writeFileSync('bower.json', JSON.stringify(bower, null, 2));
    });
}