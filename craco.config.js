const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Verify API key is loaded
if (!process.env.TIMIO_API_KEY) {
    console.error('TIMIO_API_KEY is not defined in .env.local');
    process.exit(1);
}

module.exports = {
    webpack: {
        configure: (webpackConfig) => {
            // Remove ESLint plugin
            webpackConfig.plugins = webpackConfig.plugins.filter(
                (plugin) => plugin.constructor.name !== 'ESLintWebpackPlugin'
            );

            // Add plugin to copy and transform extension files
            webpackConfig.plugins.push({
                apply: (compiler) => {
                    compiler.hooks.afterEmit.tap('CopyExtensionFiles', () => {
                        try {
                            // Copy and transform background.js
                            const backgroundSource = path.join(__dirname, 'extension', 'background.js');
                            const backgroundDest = path.join(__dirname, 'build', 'background.js');
                            
                            if (fs.existsSync(backgroundSource)) {
                                let content = fs.readFileSync(backgroundSource, 'utf8');
                                
                                // Verify API key before replacement
                                console.log('API Key available:', !!process.env.TIMIO_API_KEY);
                                console.log('API Key length:', process.env.TIMIO_API_KEY.length);

                                // Replace the placeholder with actual API key
                                content = content.replace(
                                    /TIMIO_API_KEY: ['"]__TIMIO_API_KEY__['"]/,
                                    `TIMIO_API_KEY: '${process.env.TIMIO_API_KEY}'`
                                );
                                
                                fs.writeFileSync(backgroundDest, content);
                                console.log('Successfully transformed and copied background.js');
                            } else {
                                console.error('background.js not found in extension directory');
                            }

                            // Copy content.js
                            const contentSource = path.join(__dirname, 'extension', 'content.js');
                            const contentDest = path.join(__dirname, 'build', 'content.js');
                            
                            if (fs.existsSync(contentSource)) {
                                fs.copyFileSync(contentSource, contentDest);
                                console.log('Copied content.js to build directory');
                            }

                            // Copy manifest.json from public directory
                            const manifestSource = path.join(__dirname, 'public', 'manifest.json');
                            const manifestDest = path.join(__dirname, 'build', 'manifest.json');
                            
                            if (fs.existsSync(manifestSource)) {
                                fs.copyFileSync(manifestSource, manifestDest);
                                console.log('Copied manifest.json to build directory');
                            } else {
                                console.error('manifest.json not found in public directory');
                            }
                        } catch (error) {
                            console.error('Error during file processing:', error);
                        }
                    });
                }
            });

            return webpackConfig;
        }
    }
};