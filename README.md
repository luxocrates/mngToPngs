# mngToPngs

`mngToPngs` is a  tool for converting `.mng` video
files to a sequence of `.png` images.

Specifically, it’s a quick-and-dirty JavaScript file for converting videos
recorded in [MAME](https://www.mamedev.org/) using the `-mngwrite` command-line
option. It supports no more of the `.mng` format than it needs to for this
use case, and may not work with `.mng` files created outside of MAME.

## Usage

On Unix-like systems (tested only on macOS), ensure that [Node.js](https://nodejs.org/) is installed, and use the command:

    ./mngToPngs.mjs inputFile.mng outputDir

...to create a directory named `outputDir`, and fill it with a sequence of files like:

    inputFile_00000.png
    inputFile_00001.png
    inputFile_00002.png
    ...


## License

`mngToPngs` is in the public domain.
