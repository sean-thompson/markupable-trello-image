require('dotenv').config({path: `${__dirname}/.env`});
const webpack = require('webpack');
const path = require('path');
import * as fs from 'fs';
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const dev = process.env.NODE_ENV !== 'production';

const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = (relativePath: string) => path.resolve(appDirectory, relativePath);

module.exports = (env: any) => {
    return ({
        output: {
            path: resolveApp('dist'),
            filename: 'powerup-[name]-[contenthash].js',
            library: 'react',
            clean: true
        },
        entry: {
            capabilities: resolveApp(path.join('src', 'capabilities.ts')),
            addon: resolveApp(path.join('src', 'addon.tsx'))
        },
        module: {
            rules: [
                {
                    test: /\.hbs$/,
                    loader: 'handlebars-loader'
                },
                {
                    test: /\.tsx?$/,
                    loader: 'babel-loader',
                    exclude: [
                        /(node_modules)/,
                        path.join(path.resolve(__dirname, 'src'), 'dev-watch.ts')
                    ],
                    options: {
                        cacheDirectory: true,
                        plugins: [
                            dev && require.resolve('react-refresh/babel'),
                        ].filter(Boolean),
                    },
                },
                {
                    test: /\.js$/,
                    use: ['source-map-loader'],
                    enforce: 'pre',
                    exclude: /(node_modules)/
                },
                {
                    test: /\.css$/,
                    use: [MiniCssExtractPlugin.loader, 'css-loader']
                },
                {
                    test: /\.s[ac]ss$/i,
                    use: [
                        'sass-loader'
                    ],
                },
                {
                    test: /\.(jpe?g|png|gif|svg)$/i,
                    loader: 'url-loader',
                    options: {
                        limit: 10000,
                    },
                },
            ],
        },
        devtool: !env.WEBPACK_BUILD ? 'source-map' : undefined,
        plugins: [
            new webpack.EnvironmentPlugin([
                'NODE_ENV',
                'PORT',
                'POWERUP_NAME',
                'POWERUP_ID',
                'POWERUP_APP_KEY',
                'CONTEXT_PATH'
            ]),
            new CopyWebpackPlugin({
                patterns: [
                    { from: 'static', to: 'static' },
                ],
            }),
            new MiniCssExtractPlugin(),
            new HtmlWebpackPlugin({
                chunks: ['capabilities'],
                template: 'templates/index.hbs',
                favicon: 'static/favicon.png',
                filename: 'index.html',
                templateParameters: {
                    powerup_id: process.env.POWERUP_ID,
                    powerup_name: process.env.POWERUP_NAME,
                    powerup_app_key: process.env.POWERUP_APP_KEY
                }
            }),
            new HtmlWebpackPlugin({
                chunks: ['addon'],
                template: 'templates/react.hbs',
                favicon: 'static/favicon.png',
                filename: 'attachment-section.html',
                templateParameters: {
                    powerup_name: process.env.POWERUP_NAME,
                    powerup_app_key: process.env.POWERUP_APP_KEY
                }
            }),
            new HtmlWebpackPlugin({
                chunks: ['addon'],
                template: 'templates/react.hbs',
                favicon: 'static/favicon.png',
                filename: 'card-button.html',
                templateParameters: {
                    powerup_name: process.env.POWERUP_NAME,
                    powerup_app_key: process.env.POWERUP_APP_KEY
                }
            }),
            new HtmlWebpackPlugin({
                chunks: ['addon'],
                template: 'templates/react.hbs',
                favicon: 'static/favicon.png',
                filename: 'show-settings.html',
                templateParameters: {
                    powerup_name: process.env.POWERUP_NAME,
                    powerup_app_key: process.env.POWERUP_APP_KEY
                }
            }),
            new HtmlWebpackPlugin({
                chunks: ['addon'],
                template: 'templates/react.hbs',
                favicon: 'static/favicon.png',
                filename: 'markup-editor.html',
                templateParameters: {
                    powerup_name: process.env.POWERUP_NAME,
                    powerup_app_key: process.env.POWERUP_APP_KEY
                }
            }),
            !env.WEBPACK_BUILD && new webpack.HotModuleReplacementPlugin(),
            !env.WEBPACK_BUILD && new ReactRefreshWebpackPlugin(),
        ].filter(Boolean),
        optimization: !env.WEBPACK_BUILD ? {
            minimize: true,
            usedExports: 'global',
            splitChunks: {
                chunks: 'async',
                minSize: 50000,
                maxSize: 244000,
                minChunks: 1,
                maxAsyncRequests: 30,
                maxInitialRequests: 30,
                cacheGroups: {
                    defaultVendors: {
                        test: /[\\/]node_modules[\\/]/,
                        priority: -10,
                        reuseExistingChunk: true
                    },
                    default: {
                        minChunks: 2,
                        priority: -20,
                        reuseExistingChunk: true
                    }
                }
            }
        } : undefined,
        resolve: {
            extensions: ['.ts', '.tsx', '.js', '.css']
        },
        devServer: !env.WEBPACK_BUILD ? {
            contentBase: path.join(__dirname, 'dist'),
            public: `${env.POWERUP_URL}`,
            hot: true,
            port: 3000,
            disableHostCheck: true,
            before(app: any) {
                const https = require('https');
                app.get('/trello-image', (req: any, res: any) => {
                    const { url, token } = req.query;
                    if (!url || !token) return res.status(400).send('Missing url or token');

                    let parsed;
                    try { parsed = new URL(url); } catch { return res.status(400).send('Invalid URL'); }
                    if (parsed.hostname !== 'trello.com' && parsed.hostname !== 'api.trello.com') {
                        return res.status(403).send('Only Trello URLs allowed');
                    }

                    // Always hit api.trello.com with OAuth header
                    parsed.hostname = 'api.trello.com';
                    const options = {
                        hostname: parsed.hostname,
                        path: parsed.pathname + parsed.search,
                        headers: {
                            'Authorization': `OAuth oauth_consumer_key="${process.env.POWERUP_APP_KEY}", oauth_token="${token}"`
                        }
                    };

                    const fetchUrl = (fetchOpts: any) => {
                        https.get(fetchOpts, (proxyRes: any) => {
                            // Follow one redirect (Trello → S3/CDN)
                            if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
                                https.get(proxyRes.headers.location, (finalRes: any) => {
                                    res.writeHead(finalRes.statusCode, {
                                        'Content-Type': finalRes.headers['content-type'] || 'application/octet-stream',
                                        'Cache-Control': 'private, max-age=3600'
                                    });
                                    finalRes.pipe(res);
                                }).on('error', () => res.status(502).send('Redirect failed'));
                            } else {
                                res.writeHead(proxyRes.statusCode, {
                                    'Content-Type': proxyRes.headers['content-type'] || 'application/octet-stream',
                                    'Cache-Control': proxyRes.statusCode === 200 ? 'private, max-age=3600' : 'no-cache'
                                });
                                proxyRes.pipe(res);
                            }
                        }).on('error', () => res.status(502).send('Failed to fetch from Trello'));
                    };

                    fetchUrl(options);
                });
            },
            stats: {
                colors: true,
                hash: false,
                version: false,
                timings: false,
                assets: false,
                chunks: false,
                modules: false,
                reasons: true,
                children: false,
                source: false,
                errors: true,
                errorDetails: true,
                warnings: true,
                publicPath: false
            }
        } : undefined,
        mode: env.WEBPACK_BUILD ? 'production' : 'development'
    });
};
