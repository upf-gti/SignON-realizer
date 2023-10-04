// Read, process and update shader assets

class ShaderManager {

    constructor( root ) {
        this.root = root || "";
        this.reader = new FileReader();
        this.reader.onload = this.onread.bind(this);
        this.shaderData = {};
    }

    get( shaderName ) { return this.shaderData[ shaderName ]; }

    loadFromFile( filename ) {
        this.lastShaderFile = filename;
        const url = this.root + filename;
        
        return new Promise((resolve, reject) => {

            const isAtlas = filename.includes( '.a.' );
    
            const _onerror = function(e) {

                reject(e);

                if (onerror) {
                    onerror(e);
                } else {
                    console.error(e);
                }
            };
    
            var request = new XMLHttpRequest();
            request.addEventListener("load", e => {
                console.log( '"' + filename + '" loaded!' );
                this.onread( e.currentTarget.response, filename );
                resolve();
            });
            request.addEventListener("error", _onerror);
            request.open("GET", url, true);
            request.send();
        });
    }

    async reload( shaderFile ) {
        await this.loadFromFile( shaderFile || this.lastShaderFile );
    }

    onread( shaderAtlasString, filename ) {
        this.shaderData[filename] = shaderAtlasString;
        this.shaderData[ filename ] = this.expandImports( this.shaderData[ filename ], this.shaderData );
    }

    processShaderAtlas( string ) {
        const lines = string.split("\n");
        const files = {};

        // Current shader state
        let fileLines = [];
        let fileName = "";

        for(var i = 0, l = lines.length; i < l; i++)
        {
            const line = lines[i];
            if(!line.length)
                continue;
            if( line[0] != "\\") {
                fileLines.push(line);
                continue;
            }

            if( fileLines.length )
                files[ fileName ] = fileLines.join("\n");
            fileLines.length = 0;
            fileName = line.substr(1);
        }

        if( fileLines.length )
            files[ fileName ] = fileLines.join("\n");

        return files;
    }

    addBlockSufix( string ) { return string + '.block'; }
    // getTHREEBlock( string ) { return string.replace( 'THREE.', '' ); }

    expandImports( code, shaderData ) {
        
        const cache = {};

        var replaceImport = (v) => {

            const tokens = v.split(' ');
            const id = tokens[ 1 ].trim();
            if( cache[id] )
                return '// ShaderError: Already imported: ' + id + '\n';
            cache[ id ] = true;

            // if( id.includes( 'THREE' ) ) {
            //     return THREE.ShaderChunk[ this.getTHREEBlock( id ) ] + '\n';
            // } 

            // Local blocks
            const block = shaderData[ this.addBlockSufix( id ) ];
            if(block)
                return block + '\n';

            return '// ShaderError: Import code not found: ' + id + '\n';
        }

        return code.replace( /#import\s+([a-zA-Z0-9_\.]+)\s*\n/g, replaceImport );
    }

}

export { ShaderManager };