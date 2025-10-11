const plugins = {}

try {
  // Tailwind CSS v4 exposes its PostCSS integration via @tailwindcss/postcss
  require.resolve("@tailwindcss/postcss")
  plugins["@tailwindcss/postcss"] = {}
} catch (error) {
  // Fall back to the Tailwind v3 + Autoprefixer setup if the v4 plugin isn't available
  plugins.tailwindcss = {}
  plugins.autoprefixer = {}
}

module.exports = {
  plugins,
}
