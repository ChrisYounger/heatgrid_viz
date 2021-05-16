# Heatgrid viz

Configurable Heat Grid / Heatmap visualization that can be used to show the quick status or health of many items at once. Support for grouping, and can display as hexagons, squares, diamonds or circles. Fully customisable tooltips, drilldown support, and numerous color schemes. Works in dark-mode.


Copyright (C) 2021 Chris Younger | <a href="https://splunkbase.splunk.com/app/5541/">Splunkbase</a> | [Source code](https://github.com/ChrisYounger/heatgrid_viz) |  [Questions, Bugs or Suggestions](https://answers.splunk.com/app/questions/5541.html) | [My Splunk apps](https://splunkbase.splunk.com/apps/#/author/chrisyoungerjds)


![screenshot](https://raw.githubusercontent.com/ChrisYounger/heatgrid_viz/master/appserver/static/demo.png)



## Usage

This visualisation expects data with specific field names. Use `| rename` to make sure your fields match what is expected. Every row of data will become a cell in the heatgrid. Data must always have "value" or "color" field (not both). If the "value" field is provided, the color will be automatically set based on the selected color gradiant. It is also possible to explicitly set color in the data by providing a "color" field.


```
some search... | table value tooltip group
```

See the in-app documentation for other field names that are supported


## Formatting options

![screenshot](https://raw.githubusercontent.com/ChrisYounger/heatgrid_viz/master/appserver/static/formatting.png)




## Third party software

The following third-party libraries are used by this app. Thank you!

* jQuery - MIT - https://jquery.com/
* D3 - BSD 3-Clause - https://d3js.org/
* Font Awesome - Creative Commons Attribution-ShareAlike 4.0 License - https://fontawesome.com/

