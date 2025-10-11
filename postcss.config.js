const plugins = {}

try {
  // Tailwind CSS v4 exposes its PostCSS integration via @tailwindcss/postcss
  require.resolve("@tailwindcss/postcss")
  plugins["@tailwindcss/postcss"] = {}
} catch (error) {
  // Fall back to the Tailwind v3 setup if the v4 plugin isn't available
  plugins.tailwindcss = {}

  try {
    // Autoprefixer is optional on this path, so only include it when installed
    require.resolve("autoprefixer")
    plugins.autoprefixer = {}
  } catch (autoprefixerError) {
    console.warn(
      [
        "Autoprefixer is not installed; continuing without automatic vendor prefixing.",
        "To restore vendor prefix support, install it by running:",
        "  npm install --save-dev autoprefixer",
      ].join("\n"),
    )
  }
}

module.exports = {
  plugins,
}
