import { DateTime } from "luxon";

export default function (eleventyConfig) {
  // Date formatting filter
  eleventyConfig.addFilter("dateformat", (dateObj, format = "DATETIME_FULL", zone = "utc") => {
    // DateTime presets for standard formats
    const presets = {
      "DATE_SHORT": DateTime.DATE_SHORT,
      "DATE_MED": DateTime.DATE_MED,
      "DATE_MED_WITH_WEEKDAY": DateTime.DATE_MED_WITH_WEEKDAY,
      "DATE_FULL": DateTime.DATE_FULL,
      "DATE_HUGE": DateTime.DATE_HUGE,
      "TIME_SIMPLE": DateTime.TIME_SIMPLE,
      "TIME_WITH_SECONDS": DateTime.TIME_WITH_SECONDS,
      "TIME_WITH_SHORT_OFFSET": DateTime.TIME_WITH_SHORT_OFFSET,
      "TIME_WITH_LONG_OFFSET": DateTime.TIME_WITH_LONG_OFFSET,
      "TIME_24_SIMPLE": DateTime.TIME_24_SIMPLE,
      "TIME_24_WITH_SECONDS": DateTime.TIME_24_WITH_SECONDS,
      "TIME_24_WITH_SHORT_OFFSET": DateTime.TIME_24_WITH_SHORT_OFFSET,
      "TIME_24_WITH_LONG_OFFSET": DateTime.TIME_24_WITH_LONG_OFFSET,
      "DATETIME_SHORT": DateTime.DATETIME_SHORT,
      "DATETIME_MED": DateTime.DATETIME_MED,
      "DATETIME_MED_WITH_WEEKDAY": DateTime.DATETIME_MED_WITH_WEEKDAY,
      "DATETIME_FULL": DateTime.DATETIME_FULL,
      "DATETIME_HUGE": DateTime.DATETIME_HUGE,
      "DATETIME_SHORT_WITH_SECONDS": DateTime.DATETIME_SHORT_WITH_SECONDS,
      "DATETIME_MED_WITH_SECONDS": DateTime.DATETIME_MED_WITH_SECONDS,
      "DATETIME_FULL_WITH_SECONDS": DateTime.DATETIME_FULL_WITH_SECONDS,
      "DATETIME_HUGE_WITH_SECONDS": DateTime.DATETIME_HUGE_WITH_SECONDS,
    };

    // Custom textual formats
    const textualPresets = {
      "MONTH_YEAR": "LLLL yyyy",
      "YEAR_MONTH_DAY": "yyyy-MM-dd",
      "FULL_MONTH_DAY_YEAR": "MMMM dd, yyyy",
      "DAY_MONTH_YEAR": "dd MMMM yyyy",
      "TIME_12_HOUR": "hh:mm a",
      "TIME_24_HOUR": "HH:mm",
    };

    try {
      // Convert input to DateTime object
      const dt = DateTime.fromJSDate(new Date(dateObj), { zone });

      if (presets[format]) {
        return dt.toLocaleString(presets[format]);
      } else if (textualPresets[format]) {
        return dt.toFormat(textualPresets[format]);
      } else if (format) {
        // If format is provided but not in presets, try to use it as a custom format
        return dt.toFormat(format);
      }
      
      // Default fallback
      return dt.toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS);
    } catch (error) {
      console.error("Date formatting error:", error);
      return dateObj; // Return original value if formatting fails
    }
  });

  // Server options
  eleventyConfig.setServerOptions({
    watch: [
      '_site/**/*.css',
      '_site/**/*.js',
      '_site/**/*.html'
    ],
    showAllHosts: true, // Makes the server accessible from other devices on the network
    port: process.env.PORT || 8080
  });

  // Asset handling
  eleventyConfig.addPassthroughCopy({
    'src/assets': 'assets',
    'src/_includes/js': '.',
    'src/robots.txt': 'robots.txt',
    'src/favicon.ico': 'favicon.ico',
    'src/CNAME': 'CNAME',
    'src/_redirects': '_redirects',
    'src/accrete': 'accrete',
    'src/chimistry': 'chimistry'
  });

  // Accrete (the game at /accrete) is a finished static app: copy it as-is, never run it through templates
  eleventyConfig.ignores.add("src/accrete/**");
  // Chimistry (the HCI concept game at /chimistry) is a single self-contained page: copy as-is too
  eleventyConfig.ignores.add("src/chimistry/**");

  // Watch targets for the dev server
  eleventyConfig.addWatchTarget("./src/assets/");
  eleventyConfig.addWatchTarget("./src/_includes/js/");

  // Add plugins if needed
  // eleventyConfig.addPlugin(pluginName, options);

  // Configure markdown-it options if using markdown
  let markdownOptions = {
    html: true,
    breaks: true,
    linkify: true
  };
  
  // Return the configuration object
  return {
    dir: {
      input: 'src',
      output: '_site',
      includes: '_includes',
      layouts: '_layouts',
      data: '_data'
    },
    templateFormats: [
      'html',
      'njk',
      'md',
      '11ty.js'
    ],
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    dataTemplateEngine: 'njk',
    passthroughFileCopy: true
  };
}
