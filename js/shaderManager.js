import * as THREE from 'three';

// Read, process and update shader assets

class ShaderManager {

    constructor( root ) {
        this.root = root || "";
        this.reader = new FileReader();
        this.reader.onload = this.onread.bind(this);
    }

    get( shaderName ) { return this.shaderData[ shaderName ]; }

    loadFromFile( filename ) {
        
        this.lastShaderFile = filename;

        return new Promise((resolve, reject) => {

            const url = this.root + filename;
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
                this.onread( e.currentTarget.response, isAtlas );
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

    onread( shaderAtlasString, isAtlas ) {

        if( !isAtlas ) {
            console.warn( 'Single shaders not supported. If file is a shader atlas, it has to include ".a." in its name' );
            return;
        }

        const shaderData =  this.processShaderAtlas( shaderAtlasString );
        
        for( const s in shaderData )
            shaderData[ s ] = this.expandImports( shaderData[ s ], shaderData );

        this.shaderData = shaderData;
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
    getTHREEBlock( string ) { return string.replace( 'THREE.', '' ); }

    expandImports( code, shaderData ) {
        
        const cache = {};

        var replaceImport = (v) => {

            const tokens = v.split(' ');
            const id = tokens[ 1 ].trim();
            if( cache[id] )
                return '// ShaderError: Already imported: ' + id + '\n';
            cache[ id ] = true;

            if( id.includes( 'THREE' ) ) {
                return THREE.ShaderChunk[ this.getTHREEBlock( id ) ] + '\n';
            } 

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