
/*
   TODO 
   make it so the colours pulsate/twinkle based on the last two values
   add some animations on update?
   documentation
   icon - make sure when packaged that hte app is not visible
   add better instructions to splunkbase page on how to get started
   add drilldown interaction to other addons
   linter
 */

define([
    'jquery',
    'api/SplunkVisualizationBase',
    'api/SplunkVisualizationUtils',
    'd3'
],
function(
    $,
    SplunkVisualizationBase,
    vizUtils,
    d3
) {
    var vizObj = {
        initialize: function() {
            SplunkVisualizationBase.prototype.initialize.apply(this, arguments);
            var viz = this;
            viz.instance_id = "heatgrid_viz_" + Math.round(Math.random() * 1000000);
            viz.theme = 'light'; 
            if (typeof vizUtils.getCurrentTheme === "function") {
                viz.theme = vizUtils.getCurrentTheme();
            }
            viz.$container_wrap = $(viz.el);
            viz.$container_wrap.addClass("heatgrid_viz-container heatgrid_viz-theme-" + viz.theme);
        },

        formatData: function(data) {
            return data;
        },

        updateView: function(data, config) {
            var viz = this;
            viz.config = {
                color: "greentored1", 
                colorcustom: "",
                shape: "square",
                margin: "1",
                maxrows: "5000",
                min: "0",
                max: "100",
                groupbg: "snap",
                token: "heatgrid_viz_drilldown",
            };
            // Override defaults with selected items from the UI
            for (var opt in config) {
                if (config.hasOwnProperty(opt)) {
                    viz.config[ opt.replace(viz.getPropertyNamespaceInfo().propertyNamespace,'') ] = config[opt];
                }
            }
            viz.config.min = Number(viz.config.min);
            viz.config.max = Number(viz.config.max);
            viz.config.maxrows = Number(viz.config.maxrows);
            viz.config.margin = Number(viz.config.margin);
            viz.indata = data;
            viz.scheduleDraw();
        },

        // debounce the draw
        scheduleDraw: function(){
            var viz = this;
            clearTimeout(viz.drawtimeout);
            viz.drawtimeout = setTimeout(function(){
                viz.doDraw();
            }, 300);
        },

        doDraw: function(){
            var viz = this;
            var i, j, fit;
            // Dont draw unless this is a real element under body
            if (! viz.$container_wrap.parents().is("body")) {
                return;
            }
            if (!(viz.$container_wrap.height() > 0)) {
                return;
            }
            viz.width = viz.$container_wrap.width();
            viz.height = viz.$container_wrap.height();
            viz.padding = 20;

            //console.log("got data", viz.indata);
            //console.log("height of container is : ", viz.height);
            //console.log("width of container is : ", viz.width);

            var datacolumns = {
                "value": null,
                "tooltip": null,
                "tooltip_html": null,
                "tooltip_value": null,
                "color": null,
                "group": null,
                "drilldown": null,
                "drilldown_url": null,
            };
            for (i = 0; i < viz.indata.fields.length; i++) {
                if (datacolumns.hasOwnProperty(viz.indata.fields[i].name)) {
                    datacolumns[viz.indata.fields[i].name] = i;
                } else {
                    console.log("[heatgrid_viz] Unknown column found in data: [" + viz.indata.fields[i].name + "]");
                }
            }
            viz.data = [];
            viz.groups = {};
            var maxgroupsize = 0;
            var groupheirachydata = {"name": "root", "children": []};
            for (i = 0; i < viz.indata.rows.length; i++) {
                var item = { "idx": i };
                for (var column in datacolumns) {
                    if (datacolumns.hasOwnProperty(column) && datacolumns[column] !== null) {
                        item[column] = viz.indata.rows[i][ datacolumns[column] ] === null ? "" : viz.indata.rows[i][ datacolumns[column] ];
                        if (column === "group") {
                            if (! viz.groups.hasOwnProperty(item.group)) {
                                groupheirachydata.children.push({"name": item.group, "value": 0, "children": []});
                                viz.groups[ item.group ] = {"idx": groupheirachydata.children.length - 1};
                            }
                            item.idx = groupheirachydata.children[ viz.groups[ item.group ].idx ].value;
                            groupheirachydata.children[ viz.groups[ item.group ].idx ].value ++;
                            maxgroupsize = Math.max(maxgroupsize, groupheirachydata.children[ viz.groups[ item.group ].idx ].value);
                        }
                    }
                }
                viz.data.push(item);
            }

            if (datacolumns.value === null && datacolumns.color === null) {
                viz.$container_wrap.empty().append("<div class='heatgrid_viz-bad_data'>Error: A \"value\" or \"color\" field is mandatory and could not be found.<br/>This visualization expects data with specific field names.<br />See the format dropdown button which lists the other fields that can be set.<br /><a href='/app/heatgrid_viz/documentation' target='_blank'>Click here for examples and documentation</a></div>");
                return;
            }
            if (viz.indata.rows.length > viz.config.maxrows) {
                viz.$container_wrap.empty().append("<div class='heatgrid_viz-bad_data'>Error: Too many rows of data.<br />Increase limit in formatting settings. (Total rows:" + viz.indata.rows.length + ", Limit: " + viz.config.maxrows + ").</div>");
                return;
            }

            var svg = d3.create("svg");
            svg.attr("viewBox", [0, 0, viz.width, viz.height]);
            
            viz.$container_wrap.empty().append(svg.node());
            svg.attr("width", viz.width + "px")
                .attr("height", viz.height + "px");

            var colours = {
                "greentored1": "#088F44 #2EB82E #C3CC33 #FFD442 #FFA857 #FF7149 #FE3A3A",
                "greentored2": "#a1d99b #31a354 #e6550d #de2d26",
                "greentored3": "#1e9600 #fff200 #ff0000",
                "green": "#0f9b0f #000000",
                "lightpurple": "#8e2de2 #4a00e0", 
                "darkblue": "#00d2ff #3a47d5",
                "lightblue": "#deebf7 #9ecae1 #3182bd",
                "lightorange": "#ffeda0 #feb24c #f03b20", 
                "darkorange": "#f9d423 #f83600",
                "pink": "#ff00cc #333399",
            };

            var gradiantArray;
            if (viz.config.colorcustom.length > 0) {
                gradiantArray = viz.config.colorcustom.split(" ");
                if (gradiantArray.length === 1) {
                    // make it a gradient
                    gradiantArray = [d3.hsl(gradiantArray[0]).brighter(2), d3.hsl(gradiantArray[0]).darker(2)];
                }
            } else {
                gradiantArray = colours[viz.config.color].split(" ");
            }

            var colourRangeRainbow = d3.range(viz.config.min, viz.config.max, viz.config.max / (gradiantArray.length - 1));
            colourRangeRainbow.push(viz.config.max);
            //Create color gradient
            var colorFunction = d3.scaleLinear()
                .domain(colourRangeRainbow)
                .range(gradiantArray)
                .interpolate(d3.interpolateHcl);

            viz.container_height_multiplier = 1;
            viz.container_padding_multiplier = 0;
            viz.box_draw_size_multiplier = 1;
            viz.h_box_spacing_multiplier = 1;
            viz.v_box_spacing_multiplier = 1;
            viz.h_box_offset_multiplier = 0;
            viz.v_box_offset_multiplier = 0;
            
            if (viz.config.shape === "circle") {
                viz.container_height_multiplier = 2;
                viz.container_padding_multiplier = 0.75;
                viz.box_draw_size_multiplier = 0.35;
                viz.v_box_spacing_multiplier = 0.50;
                viz.h_box_spacing_multiplier = 1;
                viz.h_box_offset_multiplier = 0.5;
                viz.v_box_offset_multiplier = 0.80;

            } else if (viz.config.shape === "diamond") {
                viz.container_height_multiplier = 2;
                viz.container_padding_multiplier = 0.75;
                viz.box_draw_size_multiplier = 0.50;
                viz.v_box_spacing_multiplier = 0.50;
                viz.h_box_spacing_multiplier = 1;
                viz.h_box_offset_multiplier = 0.5;
                viz.v_box_offset_multiplier = 0.85;

            } else if (viz.config.shape === "hexagon") {
                viz.container_height_multiplier = 1.1;
                viz.container_padding_multiplier = 0.3;
                viz.box_draw_size_multiplier = 0.59;
                viz.v_box_spacing_multiplier = 0.88;
                viz.h_box_spacing_multiplier = 1.02;
                viz.h_box_offset_multiplier = 0.5;
                viz.v_box_offset_multiplier = 0.6;
            }

            /// Process the data into proper structure
            if (datacolumns.group !== null) {
                var treemap = function(groupheirachydata) {
                    return d3.treemap()
                        .tile(d3.treemapResquarify)
                        //.tile(d3.treemapBinary)
                        .size([viz.width - (viz.padding * 2), viz.height - (viz.padding * 2)])
                        .padding(5)
                        .round(true)
                    (d3.hierarchy(groupheirachydata)
                        // You get bad results if there are very small groups. Here we force each group to be at least 15% the size of the largest group
                        .sum(function(d) { 
                            return Math.max((maxgroupsize * 0.2), d.value);
                        })
                    );
                };

                var groupdata = treemap(groupheirachydata).leaves();

                viz.final_box_size = null;
                var top_margin = 30;
                var other_margin = 6;
                for (j = 0; j < groupdata.length; j++) {
                    viz.groups[ groupdata[j].data.name ].avail_width = (groupdata[j].x1 - groupdata[j].x0 - (other_margin * 2));
                    viz.groups[ groupdata[j].data.name ].avail_height = (groupdata[j].y1 - groupdata[j].y0 - top_margin - other_margin);
                    //console.log("Group=", groupdata[j].data.name, " trying to fit " + groupdata[j].data.value + " items");
                    fit = viz.determineItemFit(
                        viz.groups[ groupdata[j].data.name ].avail_width, 
                        (viz.groups[ groupdata[j].data.name ].avail_height) * viz.container_height_multiplier, 
                        groupdata[j].data.value, 
                        viz.container_padding_multiplier
                    );
                    viz.groups[ groupdata[j].data.name ].nrows = fit.nrows;
                    viz.groups[ groupdata[j].data.name ].ncols = fit.ncols;
                    //viz.groups[ groupdata[j].data.name ].left = groupdata[j].x0 + viz.padding + other_margin;
                    //viz.groups[ groupdata[j].data.name ].top = groupdata[j].y0 + (viz.padding * 0.2) + top_margin; 
                    if (viz.final_box_size === null || fit.box_size < viz.final_box_size) {
                        viz.final_box_size = fit.box_size;
                    }
                    //console.log("Group=", groupdata[j].data.name, "can fit box_size=",fit.box_size,"rows=", fit.nrows,"cols=", fit.ncols, "last row has", groupdata[j].value % fit.ncols);
                }

                viz.box_spacing_h = viz.h_box_spacing_multiplier * viz.final_box_size;
                viz.box_spacing_v = viz.v_box_spacing_multiplier * viz.final_box_size;

                // center align the boxes in the area
                for (j = 0; j < groupdata.length; j++) {
                    // top left of grouping box
                    //viz.groups[ groupdata[j].data.name ].left = groupdata[j].x0 + viz.padding + other_margin;
                    //viz.groups[ groupdata[j].data.name ].top = groupdata[j].y0 + (viz.padding * 0.2) + top_margin; 
                    // center of grouping box
                    //console.log("group=", groupdata[j].data.name, " there is avail width of", viz.groups[ groupdata[j].data.name ].avail_width, "and we consuming", viz.box_spacing_h * viz.groups[ groupdata[j].data.name ].ncols);

                    viz.groups[ groupdata[j].data.name ].left = groupdata[j].x0 + viz.padding + other_margin + ((viz.groups[ groupdata[j].data.name ].avail_width - viz.box_spacing_h * viz.groups[ groupdata[j].data.name ].ncols) * 0.5);
                    viz.groups[ groupdata[j].data.name ].top = groupdata[j].y0 + (viz.padding * 0.5) + top_margin + ((viz.groups[ groupdata[j].data.name ].avail_height - viz.box_spacing_v * viz.groups[ groupdata[j].data.name ].nrows) * 0.5); 
                }

                //console.log("all boxes will be ", viz.final_box_size);

                var leaf = svg.selectAll("g")
                .data(groupdata)
                .join("g")
                    .attr("transform", function(d) {
                        if (viz.config.groupbg === "full") {
                            return "translate(" + (d.x0 + viz.padding) + "," + (d.y0 + viz.padding * 0.5) + ")"; 
                        } else {
                            return "translate(" + (viz.groups[ d.data.name ].left - other_margin - (viz.container_padding_multiplier * viz.final_box_size * 0.5)) + "," + (viz.groups[ d.data.name ].top - top_margin - (viz.container_padding_multiplier * viz.final_box_size * 0.5)) + ")"; 
                        }
                    });

                if (viz.config.groupbg !== "none") {
                    leaf.append("rect")
                        .attr("fill", (viz.theme === 'light' ? "#f2f4f5" : "#171d21"))
                        //.attr("fill-opacity", 0.2)
                        .attr("width", function(d) { 
                            if (viz.config.groupbg === "full") {
                                return d.x1 - d.x0;
                            } else {
                                return (viz.box_spacing_h * viz.groups[ d.data.name ].ncols) + other_margin * 2 + (viz.container_padding_multiplier * viz.final_box_size);
                            }
                        }) // todo this could be reduced to the size of the boxes for neater look
                        .attr("height", function(d) {
                            if (viz.config.groupbg === "full") {
                                return d.y1 - d.y0; 
                            } else {
                                return (viz.box_spacing_v * viz.groups[ d.data.name ].nrows) + top_margin + other_margin + (viz.container_padding_multiplier * viz.final_box_size);
                            }
                        });
                }

                leaf.append("text").append("tspan")
                    .attr("font-size", 14)
                    .attr("fill", (viz.theme === 'light' ? "black" : "white"))
                    .attr("x", 10)
                    .attr("y", 18)
                    .text(function(d){ return d.data.name; });

            } else {
                // Compute largest size the item can be to fit in the given area. also returns the rows and columns
                fit = viz.determineItemFit(
                    (viz.width - (viz.padding * 2)), 
                    ((viz.height - (viz.padding * 2)) * viz.container_height_multiplier), 
                    viz.indata.rows.length, 
                    viz.container_padding_multiplier
                );
                //console.log("box_size=",fit.box_size,"rows=", fit.nrows,"cols=", fit.ncols, "last row has", viz.indata.rows.length % fit.ncols);
                viz.final_box_size = fit.box_size;

                viz.box_spacing_h = viz.h_box_spacing_multiplier * viz.final_box_size;
                viz.box_spacing_v = viz.v_box_spacing_multiplier * viz.final_box_size;
                // Enable this box to see the area we are trying to lay stuff into
                //viz.$container_wrap.prepend(svg.append("rect").attr("width", x).attr("height", y).attr("x", "20").attr("y","1").attr("stroke","black").attr("fill","transparent").style("pointer-events","none"));

            }

            var root = svg.append("g")
                .attr("class","heatgrid_viz-group")
                .attr("stroke", (viz.theme === 'light' ? "#5E5E5E" : "#DDDDDD"))
                .attr("stroke-width", 0);

            if (datacolumns.drilldown_url !== null || datacolumns.drilldown !== null) {
                root.style("cursor","pointer");
            }

            var tooltip = $("<div class='heatgrid_viz-tooltip'></div>");
            viz.tooltip_over = false;
            viz.$container_wrap.append(tooltip);

            // debounced function to stop flashing
            var hideTooltip = viz.debounce(function() {
                if (!viz.tooltip_over) {
                    tooltip.css("visibility", "hidden");
                }
            }, 100);

            var path = "";
            var r;
            if (viz.config.shape === "hexagon") {
                path = "";
                r = ((viz.box_draw_size_multiplier * viz.final_box_size) - viz.config.margin);
                var x0 = 0, y0 = 0, x1 = 0, y1 = -1 * r;
                path += 'm' + (x1 - x0) + ' ' + (y1 - y0);
                x0 = x1;
                y0 = y1;

                x1 = Math.sin(Math.PI / 3) * r;
                y1 = -Math.cos(Math.PI / 3) * r;
                path += 'l' + (x1 - x0) + ' ' + (y1 - y0);
                x0 = x1;
                y0 = y1;

                x1 = Math.sin(2 * Math.PI / 3) * r;
                y1 = -Math.cos(2 * Math.PI / 3) * r;
                path += 'l' + (x1 - x0) + ' ' + (y1 - y0);
                x0 = x1;
                y0 = y1;

                x1 = Math.sin(3 * Math.PI / 3) * r;
                y1 = -Math.cos(3 * Math.PI / 3) * r;
                path += 'l' + (x1 - x0) + ' ' + (y1 - y0);
                x0 = x1;
                y0 = y1;

                x1 = Math.sin(4 * Math.PI / 3) * r;
                y1 = -Math.cos(4 * Math.PI / 3) * r;
                path += 'l' + (x1 - x0) + ' ' + (y1 - y0);
                x0 = x1;
                y0 = y1;

                x1 = Math.sin(5 * Math.PI / 3) * r;
                y1 = -Math.cos(5 * Math.PI / 3) * r;
                path += 'l' + (x1 - x0) + ' ' + (y1 - y0);
                path += ' z';
            }

            if (viz.config.shape === "square") {
                r = ((viz.box_draw_size_multiplier * viz.final_box_size) - (2 * viz.config.margin)); 
                path = ' h ' + r + ' v ' + r + ' h -' + r + ' z';
            }
            if (viz.config.shape === "diamond") {
                r = ((viz.box_draw_size_multiplier * viz.final_box_size) - viz.config.margin) ;
                path = 'm 0 -'+ r +' l ' + r + ' ' + r + ' l -' + r + ' ' + r + ' l -' + r + ' -' + r + ' z';
            }
            if (viz.config.shape === "circle") {
                r = ((viz.box_draw_size_multiplier * viz.final_box_size) - viz.config.margin);
                path = 'm -'+ r +' 0 a '+r+','+r+' 0 1,0 '+(r*2)+',0 a '+r+','+r+' 0 1,0 -'+(r*2)+',0';
            }

            var nongrouped_left_offset = (viz.width - viz.box_spacing_h * fit.ncols) * 0.5; // left offset is 50% of the space not consumed.
            var nongrouped_top_offset = (viz.height - viz.box_spacing_v * fit.nrows) * 0.1; // top off set is 10% - mostly at the top, not vertically centered

            root
            .selectAll("path")
            .data(viz.data)
            .enter()
                .append("path")
                .attr("d", function(d) {
                    var left_offset, top_offset, ncols;
                    if (datacolumns.group === null) {
                        left_offset = nongrouped_left_offset;
                        top_offset = nongrouped_top_offset;
                        ncols = fit.ncols;
                    } else {
                        left_offset = viz.groups[ d.group ].left;
                        top_offset = viz.groups[ d.group ].top;
                        ncols = viz.groups[ d.group ].ncols;
                    }
                            
                    left_offset += (viz.box_spacing_h * viz.h_box_offset_multiplier);
                    top_offset += (viz.box_spacing_v * viz.v_box_offset_multiplier);

                    left_offset = (((d.idx % ncols) * viz.box_spacing_h) + left_offset);
                    top_offset = ((Math.floor(d.idx / ncols)) * viz.box_spacing_v + top_offset);
                    if (viz.config.shape != "square") {
                        if ((Math.floor(d.idx / ncols)) % 2 === 0) {
                            left_offset = left_offset - viz.box_spacing_h * 0.25;
                        } else {
                            left_offset = left_offset + viz.box_spacing_h * 0.25;
                        }
                    }
                    return 'M '+ left_offset +' '+ top_offset +' ' + path + ' z';
                })
                .attr("fill", function(d) { return (datacolumns.color === null) ? colorFunction(Math.min(Math.max(d.value, viz.config.min), viz.config.max)) : d.color; })
                .on("mouseover", function(d) { 
                    d3.select(this).transition().duration(10).attr("stroke-width", 3);
                    var tt = $("<div></div>");
                    var hascontents = false;
                    if (datacolumns.tooltip_html === null) {
                        if (datacolumns.tooltip !== null && d.tooltip !== "") {
                            $("<div></div>").text(d.tooltip).appendTo(tt);
                            hascontents = true;
                        }
                        if (datacolumns.tooltip_value !== null && d.tooltip_value !== "") {
                            $("<div style='text-align:right; font-weight:bold;'></div>").text(d.tooltip_value).appendTo(tt);
                            hascontents = true;
                        } else if (datacolumns.value !== null && d.value !== "") {
                            $("<div style='text-align:right; font-weight:bold;'></div>").text(d.value).appendTo(tt);
                            hascontents = true;
                        }
                    } else if (d.tooltip_html !== "") {
                        tt.html(d.tooltip_html).appendTo(tt);
                        hascontents = true;
                    }
                    if (hascontents){
                        viz.container_wrap_offset = viz.$container_wrap.offset();
                        viz.tooltip_over = true;
                        return tooltip.css("visibility", "visible").html(tt);
                    }
                })
                .on("mousemove", function() { 
                    // assume a 50px tooltip height for simplicity
                    var tt_height = 100;
                    //position the box about the middle, but limit when near top or bottom
                    tooltip.css("top", Math.max(10, Math.min((viz.height - tt_height), (event.pageY - viz.container_wrap_offset.top) - (tt_height / 2))));
                    // show on the left or right of point depending on whcih side of the chart we are on
                    var left_position = event.pageX - viz.container_wrap_offset.left;
                    if (left_position < viz.width / 2){ 
                        tooltip.css({"left": left_position + 40, "right": ""});
                    } else {
                        tooltip.css({"left": "", "right": viz.width - left_position + 40});
                    }
                })
                .on("mouseout", function(){
                    d3.select(this).transition().duration(300).attr("stroke-width", 0);
                    viz.tooltip_over = false;
                    hideTooltip();
                })
                .on("click", function(d, browserEvent){
                    if (datacolumns.drilldown_url !== null) {
                        window.open(d.drilldown_url, '_blank');
                    } else if (datacolumns.drilldown !== null) {
                        // TODO do we need to call the actual drilldown function?
                        var defaultTokenModel = splunkjs.mvc.Components.get('default');
                        var submittedTokenModel = splunkjs.mvc.Components.get('submitted');
                        var tokenvalue = d.drilldown;
                        if (tokenvalue === null) {
                            tokenvalue = "";
                        }
                        console.log("[heatgrid_viz] Setting token $" + viz.config.token + "$ to \"" + tokenvalue + "\"");
                        if (defaultTokenModel) {
                            defaultTokenModel.set(viz.config.token, tokenvalue);
                            defaultTokenModel.set("form." + viz.config.token, tokenvalue);
                        } 
                        if (submittedTokenModel) {
                            submittedTokenModel.set(viz.config.token, tokenvalue);
                            submittedTokenModel.set("form." + viz.config.token, tokenvalue); // TODO is the .form one needed?
                        }
                        var toks = {};
                        toks[viz.config.token] = tokenvalue;
                        viz.drilldown({
                            action: SplunkVisualizationBase.FIELD_VALUE_DRILLDOWN,
                            data: toks
                        }, event);
                    } else {
                        console.log("[heatgrid_viz] Token not set becuase there is no \"drilldown\" field in the data");
                    }
                });
        },

        determineItemFit: function(x, y, n, padding_multiple) {
            var ratio = x / y;
            var ncols_float = Math.sqrt(n * ratio);
            var nrows_float = n / ncols_float;

            // Find best option filling the whole height
            var nrows1 = Math.ceil(nrows_float);
            var ncols1 = Math.ceil(n / nrows1);
            while (nrows1 * ratio < ncols1) {
                nrows1++;
                ncols1 = Math.ceil(n / nrows1);
            }
            var box_size1 = y / nrows1;

            // Find best option filling the whole width
            var ncols2 = Math.ceil(ncols_float);
            var nrows2 = Math.ceil(n / ncols2);
            while (ncols2 < nrows2 * ratio) {
                ncols2++;
                nrows2 = Math.ceil(n / ncols2);
            }
            var box_size2 = x / ncols2;

            // Find the best values
            var fit;
            if (box_size1 < box_size2) {
                fit = {
                    "nrows": nrows2,
                    "ncols": ncols2,
                    "box_size": box_size2,
                };
            } else {
                fit = {
                    "nrows": nrows1,
                    "ncols": ncols1,
                    "box_size": box_size1,
                };
            }
            if (padding_multiple) {
                // with these ones we need to make the boxes a percentage smaller to account for stuff around the edges
                var w_multiplier = (x / fit.ncols) / x;
                var h_multiplier = (y / fit.nrows) / y;
                var o_multiplier = (Math.max(w_multiplier, h_multiplier));
                fit.box_size -= (fit.box_size * o_multiplier * padding_multiple); // needs to be percentage of the contribution 
            }
            return fit;
        },

        debounce: function(func, wait, immediate) {
            var timeout;
            return function() {
                var context = this, args = arguments;
                var later = function() {
                    timeout = null;
                    if (!immediate) func.apply(context, args);
                };
                var callNow = immediate && !timeout;
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
                if (callNow) func.apply(context, args);
            };
        },

        // Override to respond to re-sizing events
        reflow: function() {
            this.scheduleDraw();
        },

        // Search data params
        getInitialDataParams: function() {
            return ({
                outputMode: SplunkVisualizationBase.ROW_MAJOR_OUTPUT_MODE,
                count: 10000
            });
        },
    };
    return SplunkVisualizationBase.extend(vizObj);
});