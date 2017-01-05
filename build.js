var fs = require('fs'),
    browserify = require('browserify');

browserify('./src/roomrtc', {
        standalone: 'RoomRTC',
        debug: true
    })
    .transform("babelify", {
        presets: ["es2015"]
    })
    .bundle()
    .pipe(fs.createWriteStream("dist/roomrtc.bundle.js"));