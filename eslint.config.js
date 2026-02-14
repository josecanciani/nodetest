import globals from 'globals';

export default [
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.node
            }
        },
        rules: {
            'indent': ['error', 4],
            'no-unused-vars': 'error',
            'no-undef': 'error'
        }
    }
];
