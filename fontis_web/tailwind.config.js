/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Corporate Design Overrides
                blue: {
                    50: '#f0f6f9',
                    100: '#e0edf4',
                    200: '#c2dbn9',
                    300: '#99b8d2',
                    400: '#7395b3',
                    500: '#66A8CB', // Target Base
                    600: '#528cae', // Hover
                    700: '#43728f',
                    800: '#365a71',
                    900: '#2b4759',
                },
                green: {
                    50: '#f3f7ef',
                    100: '#e7efdf',
                    200: '#cbe0bb',
                    300: '#adc996',
                    400: '#95b778',
                    500: '#8BB158', // Target Base
                    600: '#739546', // Hover
                    700: '#5a7635',
                    800: '#455a28',
                    900: '#303f1d',
                },
                amber: {
                    50: '#fdf7f1',
                    100: '#faebd9',
                    200: '#f2d0a8',
                    300: '#e8b173',
                    400: '#df9449',
                    500: '#CC823F', // Target Base
                    600: '#b36622', // Hover
                    700: '#914d13',
                    800: '#6e380a',
                    900: '#4d2503',
                }
            }
        },
    },
    plugins: [],
}
