module.exports = function override(config, env) {
    return {
        ...config,
        module: {
            ...config.module,
            rules: [
                ...config.module.rules,
                {
                    test: /\.scss$/,
                    use: [
                        "sass-loader",
                        {
                            loader: "sass-resources-loader",
                            options: {
                                // Provide path to the file with resources
                                resources: [
                                    "./src/assets/scss/mixins.scss",
                                    "./src/assets/scss/variables.scss",
                                ],
                            },
                        },
                    ],
                },
            ],
        },
    };
};
