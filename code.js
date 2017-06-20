function ema(prices,days){
    var num = 0,
    den = 0,
    alpha = (2/(days+1));
    for(var i = 0; i < days; i++){
        var price = prices[i];
        num += Math.pow((1-alpha),i)*price;
        den += Math.pow((1-alpha),i);
    }
    return num/den;
}

function macd(data){
    var macd = ema(data,12) - ema(data,26),
    macds = [];
    for(var i = 2; i < 9; i++){
        var tempMacd = ema(data.slice(i),12) - ema(data.slice(i),26);
        macds.push(tempMacd);
    }
    var trigger = ema(macds,macds.length);
    return([macd,trigger]);
}

var svg = d3.select("svg"),
    margin = {top: 20, right: 80, bottom: 30, left: 50},
    width = svg.attr("width") - margin.left - margin.right,
    height = svg.attr("height") - margin.top - margin.bottom,
    g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var parseTime = d3.timeParse("%Y%m%d");

var x = d3.scaleTime().range([0, width]),
    y = d3.scaleLinear().range([height, 0]),
    y2 = d3.scaleLinear().range([height, 0]),
    z = d3.scaleOrdinal(d3.schemeCategory10);

var line = d3.line()
    .curve(d3.curveBasis)
    .x(function(d) { return x(d.date); })
    .y(function(d) { return y(d.value); });
    
var line2 = d3.line()
    .curve(d3.curveBasis)
    .x(function(d) { return x(d.date); })
    .y(function(d) { return y2(d.value); });

function loadCoinDesk(){
    var d1 = new Date();
    d1.setDate(d1.getDate()-1);
    var t1 = d1.toISOString().substring(0,10);
    var d2 = new Date();
    d2.setDate(d2.getDate()-64);
    var t2 = d2.toISOString().substring(0,10);
    var url = "http://api.coindesk.com/v1/bpi/historical/close.json?start="+t2+"&end="+t1;
    $.getJSON(url,function(result){
        var data = [],
        dates = [],
        prices = [];
        for(var date in result.bpi){
            var close = result.bpi[date];
            dates.push(date);
            prices.push(close);
        }
        //Reverse chronological order?
        prices = prices.reverse();
        dates = dates.reverse();
        var days = prices.length-33;
        var priceObjs = {"id":"Price","values":[]},
        macdObjs = {"id":"MACD","values":[]},
        triggerObjs = {"id":"Trigger","values":[]};
        for(var i = 0; i < days; i++){
            var pObj = {},
            mObj = {},
            tObj = {},
            slicedPrices = prices.slice(i),
            latest = dates[i],
            macdArr = macd(slicedPrices),
            thisMacd = macdArr[0],
            thisTrigger = macdArr[1];
            pObj.date = new Date(latest);
            mObj.date = new Date(latest);
            tObj.date = new Date(latest);
            pObj.value = slicedPrices[0];
            mObj.value = thisMacd;
            tObj.value = thisTrigger;
            priceObjs.values.push(pObj);
            macdObjs.values.push(mObj);
            triggerObjs.values.push(tObj);
        }
        data.push(priceObjs);
        data.push(macdObjs);
        data.push(triggerObjs);
        console.log(data);
        updateChart(data);
    });
}

function updateChart(data){
    x.domain(d3.extent(data[0].values, function(d) { return d.date; }));

  y2.domain([
    d3.min(data.slice(1), function(c) { return d3.min(c.values, function(d) { return d.value; }); }),
    d3.max(data.slice(1), function(c) { return d3.max(c.values, function(d) { return d.value; }); })
  ]);
  
  y.domain([
    d3.min(data, function(c) { return d3.min(c.values, function(d) { return d.value; }); }),
    d3.max(data, function(c) { return d3.max(c.values, function(d) { return d.value; }); })
  ]);

  z.domain(data.map(function(c) { return c.id; }));

  g.append("g")
      .attr("class", "axis axis--x")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x));

  g.append("g")
      .attr("class", "axis axis--y")
      .call(d3.axisLeft(y))
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", "0.71em")
      .attr("fill", "#000")
      .text("Price");
      
    g.append("g")
      .attr("class", "axis axis--y")
      .attr("transform", "translate( " + width + ", 0 )")
      .call(d3.axisRight(y2))
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -15)
      .attr("x", -130)
      .attr("dy", "0.71em")
      .attr("fill", "#000")
      .text("Moving Average Differential");

  var macdAndTrigger = g.selectAll(".macdAndTrigger")
    .data(data.slice(1))
    .enter().append("g")
      .attr("class", "macdAndTrigger");

  macdAndTrigger.append("path")
      .attr("class", "line")
      .attr("d", function(d) { return line2(d.values); })
      .style("stroke", function(d) { return z(d.id); });

  macdAndTrigger.append("text")
      .datum(function(d) { return {id: d.id, value: d.values[d.values.length - 1]}; })
      .attr("transform", function(d) { return "translate(" + x(d.value.date) + "," + y2(d.value.value) + ")"; })
      .attr("x", 3)
      .attr("dy", "0.35em")
      .style("font", "10px sans-serif")
      .text(function(d) { return d.id; });
      
var price = g.selectAll(".price")
    .data(data.slice(0,1))
    .enter().append("g")
      .attr("class", "price");

  price.append("path")
      .attr("class", "line")
      .attr("d", function(d) { return line(d.values); })
      .style("stroke", function(d) { return z(d.id); });

  price.append("text")
      .datum(function(d) { return {id: d.id, value: d.values[d.values.length - 1]}; })
      .attr("transform", function(d) { return "translate(" + x(d.value.date) + "," + y(d.value.value) + ")"; })
      .attr("x", 3)
      .attr("dy", "0.35em")
      .style("font", "10px sans-serif")
      .text(function(d) { return d.id; });

}