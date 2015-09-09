d3.csv("summary.csv", function(error, tests) {

    var nestBy = function(field) {
        return d3.nest()
            .key(function(d) { return Math.floor(d[field]); });
    };


    // formatters.
    var formatNumber = d3.format(",d");

    // A little coercion, since the CSV is untyped.
    tests.forEach(function(d, i) {
        d.index = i;
        d.maxcurr = +d.maxcurr;
        d.maxthr = +d.maxthr;
        d.pwm200 = +d.pwm200;
        d.curr200 = +d.curr200;
        d.gpw200 = +d.gpw200;
        d.curr50 = +d.curr50;
        d.thr50 = +d.thr50;
        d.propd = d.prop.match(/.*(\d{4}).*/)[1];
        if (d.propd[1] == "0") {
            d.propd = +d.propd[0];
        } else {
            d.propd = +d.propd.substr(0, 2);
        }
    });

    // Create the crossfilter for the relevant dimensions and groups.
    var test = crossfilter(tests),
        all = test.groupAll(),
        maxcurr = test.dimension(function(d) { return d.maxcurr; }),
        maxcurrs = maxcurr.group(Math.floor),
        maxthr = test.dimension(function(d) { return d.maxthr; }),
        maxthrs = maxthr.group(Math.floor),
        pwm200 = test.dimension(function(d) { return d.pwm200; }),
        pwm200s = pwm200.group(Math.floor),
        curr200 = test.dimension(function(d) { return d.curr200; }),
        curr200s = curr200.group(Math.floor),
        gpw200 = test.dimension(function(d) { return d.gpw200; }),
        gpw200s = gpw200.group(Math.floor),
        curr50 = test.dimension(function(d) { return d.curr50; }),
        curr50s = curr50.group(Math.floor),
        thr50 = test.dimension(function(d) { return d.thr50; }),
        thr50s = thr50.group(Math.floor),
        batt = test.dimension(function(d) { return d.batt; }),
        batts = batt.group(),
        prop = test.dimension(function(d) { return d.propd; }),
        props = prop.group();

    var charts = [

        barChart()
            .dimension(maxcurr)
            .group(maxcurrs)
            .x(d3.scale.linear()
               .domain([3, 40])
               .rangeRound([0, 200])),

        barChart()
            .dimension(maxthr)
            .group(maxthrs)
            .x(d3.scale.linear()
               .domain([100, 1400])
               .rangeRound([0, 440])),

        barChart()
            .dimension(pwm200)
            .group(pwm200s)
            .x(d3.scale.linear()
               .domain([1100, 1900])
               .rangeRound([0, 400])),

        barChart()
            .dimension(curr200)
            .group(curr200s)
            .x(d3.scale.linear()
               .domain([2, 7])
               .rangeRound([0, 180])),

        barChart()
            .dimension(gpw200)
            .group(gpw200s)
            .x(d3.scale.linear()
               .domain([2, 6])
               .rangeRound([0, 130])),

        barChart()
            .dimension(curr50)
            .group(curr50s)
            .x(d3.scale.linear()
               .domain([1, 11])
               .rangeRound([0, 120])),

        barChart()
            .dimension(thr50)
            .group(thr50s)
            .x(d3.scale.linear()
               .domain([40, 700])
               .rangeRound([0, 250]))
            .filter([125, 250]),
    ];

    // Given our array of charts, which we assume are in the same order as the
    // .chart elements in the DOM, bind the charts to the DOM and render them.
    // We also listen to the chart's brush events to update the display.
    var chart = d3.selectAll(".chart")
        .data(charts)
        .each(function(chart) { chart.on("brush", renderAll).on("brushend", renderAll); });

    // Render the initial lists.
    var list = d3.selectAll(".list")
        .data(testList(thr50, 'thr50', true));

    var battsel = d3.select("#batteryselect");
    battsel.on("change", function() {
        var options = battsel.selectAll('option');
        var selectedIndex = battsel.property('selectedIndex'),
            data          = options[0][selectedIndex].__data__;
        batt.filter(data ? data.key : null);
        renderAll();
    });

    var propsel = d3.select("#propselect");
    propsel.on("change", function() {
        var options = propsel.selectAll('option');
        var selectedIndex = propsel.property('selectedIndex'),
            data          = options[0][selectedIndex].__data__;
        prop.filterRange([0, data ? data.key+1 : 10000]);
        renderAll();
    });

    // Render the total.
    d3.selectAll("#total")
        .text(formatNumber(test.size()));

    renderAll();

    // Renders the specified chart or list.
    function render(method) {
        d3.select(this).call(method);
    }

    // Whenever the brush moves, re-rendering everything.
    function renderAll() {
        chart.each(render);
        list.each(render);

        var b = battsel.selectAll(".batt")
            .data(batts.reduceCount().all().filter(function(d) { return d.value > 0; }));

        b.enter().append("option")
            .attr("class", "batt");

        b.text(function(d) { return d.key; });

        b.exit().remove();

        var p = propsel.selectAll(".prop")
            .data(props.reduceCount().all().filter(function(d) { return d.value > 0; }));

        p.enter().append("option")
            .attr("class", "prop");

        p.text(function(d) { return d.key; });

        p.exit().remove();

        d3.select("#active").text(formatNumber(all.value()));
    }

    window.filter = function(filters) {
        filters.forEach(function(d, i) { charts[i].filter(d); });
        renderAll();
    };

    window.reset = function(i) {
        charts[i].filter(null);
        renderAll();
    };

    function testList(listField, listFieldS, rev) {
        return [function(div) {
            var listEntries = nestBy(listFieldS).entries(listField.top(40));
            if (rev) {
                listEntries = listEntries.reverse();
            }

            div.each(function() {
                var l = d3.select(this).selectAll(".entry")
                    .data(listEntries, function(d) { return d.key; });

                l.enter().append("div")
                    .attr("class", "entry");

                l.exit().remove();

                var test = l.order().selectAll(".test")
                    .data(function(d) { return d.values; }, function(d) { return d.index; });

                var testEnter = test.enter().append("div")
                    .attr("class", "test");

                testEnter.append("div")
                    .attr("class", "motor")
                    .text(function(d) { return d.mfg + ' ' + d.size + '/' + d.kv + 'kv'; });

                testEnter.append("div")
                    .attr("class",  "prop")
                    .text(function(d) { return d.prop; });

                testEnter.append("div")
                    .attr("class", "batt")
                    .text(function(d) { return d.batt; });

                testEnter.append("div")
                    .attr("class", "maxcurr")
                    .text(function(d) { return d.maxcurr + "A"; });

                testEnter.append("div")
                    .attr("class", "curr200")
                    .text(function(d) { return d.curr200 + "A@200g"; });

                testEnter.append("div")
                    .attr("class", "thr50")
                    .text(function(d) { return d.thr50 + "g@50%"; });

                testEnter.append("div")
                    .attr("class", "maxthr")
                    .text(function(d) { return d.maxthr + "g max"; });

                test.exit().remove();

            });
        }];
    }

    function barChart() {
        if (!barChart.id) barChart.id = 0;

        var margin = {top: 10, right: 10, bottom: 20, left: 10},
            x,
            y = d3.scale.linear().range([100, 0]),
            id = barChart.id++,
            axis = d3.svg.axis().orient("bottom"),
            brush = d3.svg.brush(),
            brushDirty,
            dimension,
            group,
            round;

        function chart(div) {
            var width = x.range()[1],
                height = y.range()[0];

            y.domain([0, group.top(1)[0].value]);

            div.each(function() {
                var div = d3.select(this),
                    g = div.select("g");

                // Create the skeletal chart.
                if (g.empty()) {
                    div.select(".title").append("a")
                        .attr("href", "javascript:reset(" + id + ")")
                        .attr("class", "reset")
                        .text("reset")
                        .style("display", "none");

                    g = div.append("svg")
                        .attr("width", width + margin.left + margin.right)
                        .attr("height", height + margin.top + margin.bottom)
                        .append("g")
                        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                    g.append("clipPath")
                        .attr("id", "clip-" + id)
                        .append("rect")
                        .attr("width", width)
                        .attr("height", height);

                    g.selectAll(".bar")
                        .data(["background", "foreground"])
                        .enter().append("path")
                        .attr("class", function(d) { return d + " bar"; })
                        .datum(group.all());

                    g.selectAll(".foreground.bar")
                        .attr("clip-path", "url(#clip-" + id + ")");

                    g.append("g")
                        .attr("class", "axis")
                        .attr("transform", "translate(0," + height + ")")
                        .call(axis);

                    // Initialize the brush component with pretty resize handles.
                    var gBrush = g.append("g").attr("class", "brush").call(brush);
                    gBrush.selectAll("rect").attr("height", height);
                    gBrush.selectAll(".resize").append("path").attr("d", resizePath);
                }

                // Only redraw the brush if set externally.
                if (brushDirty) {
                    brushDirty = false;
                    g.selectAll(".brush").call(brush);
                    div.select(".title a").style("display", brush.empty() ? "none" : null);
                    if (brush.empty()) {
                        g.selectAll("#clip-" + id + " rect")
                            .attr("x", 0)
                            .attr("width", width);
                    } else {
                        var extent = brush.extent();
                        g.selectAll("#clip-" + id + " rect")
                            .attr("x", x(extent[0]))
                            .attr("width", x(extent[1]) - x(extent[0]));
                    }
                }

                g.selectAll(".bar").attr("d", barPath);
            });

            function barPath(groups) {
                var path = [],
                    i = -1,
                    n = groups.length,
                    d;
                while (++i < n) {
                    d = groups[i];
                    path.push("M", x(d.key), ",", height, "V", y(d.value), "h9V", height);
                }
                return path.join("");
            }

            function resizePath(d) {
                var e = +(d == "e"),
                    x = e ? 1 : -1,
                    y = height / 3;
                return "M" + (.5 * x) + "," + y
                    + "A6,6 0 0 " + e + " " + (6.5 * x) + "," + (y + 6)
                    + "V" + (2 * y - 6)
                    + "A6,6 0 0 " + e + " " + (.5 * x) + "," + (2 * y)
                    + "Z"
                    + "M" + (2.5 * x) + "," + (y + 8)
                    + "V" + (2 * y - 8)
                    + "M" + (4.5 * x) + "," + (y + 8)
                    + "V" + (2 * y - 8);
            }
        }

        brush.on("brushstart.chart", function() {
            var div = d3.select(this.parentNode.parentNode.parentNode);
            div.select(".title a").style("display", null);
        });

        brush.on("brush.chart", function() {
            var g = d3.select(this.parentNode),
                extent = brush.extent();
            if (round) g.select(".brush")
                .call(brush.extent(extent = extent.map(round)))
                .selectAll(".resize")
                .style("display", null);
            g.select("#clip-" + id + " rect")
                .attr("x", x(extent[0]))
                .attr("width", x(extent[1]) - x(extent[0]));
            dimension.filterRange(extent);
        });

        brush.on("brushend.chart", function() {
            if (brush.empty()) {
                var div = d3.select(this.parentNode.parentNode.parentNode);
                div.select(".title a").style("display", "none");
                div.select("#clip-" + id + " rect").attr("x", null).attr("width", "100%");
                dimension.filterAll();
            }
        });

        chart.margin = function(_) {
            if (!arguments.length) return margin;
            margin = _;
            return chart;
        };

        chart.x = function(_) {
            if (!arguments.length) return x;
            x = _;
            axis.scale(x);
            brush.x(x);
            return chart;
        };

        chart.y = function(_) {
            if (!arguments.length) return y;
            y = _;
            return chart;
        };

        chart.dimension = function(_) {
            if (!arguments.length) return dimension;
            dimension = _;
            return chart;
        };

        chart.filter = function(_) {
            if (_) {
                brush.extent(_);
                dimension.filterRange(_);
            } else {
                brush.clear();
                dimension.filterAll();
            }
            brushDirty = true;
            return chart;
        };

        chart.group = function(_) {
            if (!arguments.length) return group;
            group = _;
            return chart;
        };

        chart.round = function(_) {
            if (!arguments.length) return round;
            round = _;
            return chart;
        };

        return d3.rebind(chart, brush, "on");
    }
});
