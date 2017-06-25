var svg = d3.select("svg"),
    marginStock = {top: 20, right: 80, bottom: 50, left: 50},
    widthStock = 850 - marginStock.left - marginStock.right,
    heightStock = 225 - marginStock.top - marginStock.bottom,
    marginMacd = {top: heightStock + marginStock.bottom, right: 80, bottom: 30, left: 50},
    widthMacd = 850 - marginMacd.left - marginMacd.right,
    heightMacd = heightStock,
    gStock = svg.append("g").attr("transform", "translate(" + marginStock.left + "," + marginStock.top + ")"),
    gMacd = svg.append("g").attr("transform", "translate(" + marginMacd.left + "," + marginMacd.top + ")");

var parseTime = d3.timeParse("%Y%m%d");

var x = d3.scaleTime().range([0, widthStock]),
    y = d3.scaleLinear().range([heightStock, 0]),
    y2 = d3.scaleLinear().range([heightMacd, 0]),
    z = d3.scaleOrdinal(d3.schemeCategory10);
    
var line = d3.line()
    .curve(d3.curveBasis)
    .x(function(d) { return x(d.date); })
    .y(function(d) { return y(d.value); });
    
var line2 = d3.line()
    .curve(d3.curveBasis)
    .x(function(d) { return x(d.date); })
    .y(function(d) { return y2(d.value); });
    

var coinDeskJson;

//First draw
var settings = $('#length_settings').val().split(",").map(Number);
fetchCoinDeskJSON()
    .then(success => {coinDeskJson=success; return parseCoinDeskJSON(coinDeskJson,settings);})
    .then(success => updateChart(success))
    .then(success => {$("#loading").hide();$("#selector").show();});

function chart(){
    var settings = $('#length_settings').val().split(",").map(Number);
    var data = parseCoinDeskJSON(coinDeskJson,settings);
    updateChart(data);
}

$("#length_settings").change(chart);

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

function macd(data,settings){
    var a = settings[0],
    b = settings[1],
    c = settings[2];
    var macd = ema(data,a) - ema(data,b),
    macds = [];
    for(var i = 2; i < c; i++){
        var tempMacd = ema(data.slice(i),a) - ema(data.slice(i),b);
        macds.push(tempMacd);
    }
    var trigger = ema(macds,macds.length);
    return([macd,trigger]);
}

//Load async with promises
function fetchCoinDeskJSON(){
    var d1 = new Date();
    d1.setDate(d1.getDate()-1);
    var t1 = d1.toISOString().substring(0,10);
    var d2 = new Date();
    d2.setDate(d2.getDate()-72);
    var t2 = d2.toISOString().substring(0,10);
    var url = "http://api.coindesk.com/v1/bpi/historical/close.json?start="+t2+"&end="+t1;
    return fetch(url).then(x => x.json());
}

function parseCoinDeskJSON(json,settings){
    var data = [],
    crosses = [],
    dates = [],
    prices = [];
    for(var date in json.bpi){
        var close = json.bpi[date];
        dates.push(date);
        prices.push(close);
    }
    prices = prices.reverse();
    dates = dates.reverse();
    var days = prices.length-41;
    var priceObjs = {"id":"Price","values":[]},
    macdObjs = {"id":"MACD","values":[]},
    triggerObjs = {"id":"Trigger","values":[]},
    firstDay = true,
    tomorrowBullish = false;
    for(var i = 0; i < days; i++){
        var pObj = {},
        mObj = {},
        tObj = {},
        slicedPrices = prices.slice(i),
        latest = dates[i],
        macdArr = macd(slicedPrices,settings),
        thisMacd = macdArr[0],
        thisTrigger = macdArr[1],
        todayBullish = thisMacd >= thisTrigger;
        if(!firstDay){
            var tomorrow = dates[i-1];
            if(tomorrowBullish != todayBullish){
                //Crossover
                var cObj = {};
                cObj.date = new Date(tomorrow);
                cObj.bullish = tomorrowBullish;
                crosses.push(cObj);
            }
        }
        tomorrowBullish = todayBullish;
        pObj.date = new Date(latest);
        mObj.date = new Date(latest);
        tObj.date = new Date(latest);
        pObj.value = slicedPrices[0];
        mObj.value = thisMacd;
        tObj.value = thisTrigger;
        priceObjs.values.push(pObj);
        macdObjs.values.push(mObj);
        triggerObjs.values.push(tObj);
        firstDay = false;
    }
    data.push(priceObjs);
    data.push(macdObjs);
    data.push(triggerObjs);
    return {"data":data,"crosses":crosses};
}

function updateChart(dataObj){
    var data = dataObj.data;
    var crosses = dataObj.crosses;
    gStock.html("");
    gMacd.html("");
    x.domain(d3.extent(data[0].values, function(d) { return d.date; }));

  y.domain([
    d3.min(data.slice(0,1), function(c) { return d3.min(c.values, function(d) { return d.value; }); }),
    d3.max(data.slice(0,1), function(c) { return d3.max(c.values, function(d) { return d.value; }); })
  ]);
  
  y2.domain([
    d3.min(data.slice(1), function(c) { return d3.min(c.values, function(d) { return d.value; }); }),
    d3.max(data.slice(1), function(c) { return d3.max(c.values, function(d) { return d.value; }); })
  ]);

  z.domain(data.map(function(c) { return c.id; }));

  gStock.append("g")
      .attr("class", "axis axis--x")
      .attr("transform", "translate(0," + heightStock + ")")
      .call(d3.axisBottom(x));
  gMacd.append("g")
      .attr("class", "axis axis--x")
      .attr("transform", "translate(0," + heightMacd + ")")
      .call(d3.axisBottom(x));

  gStock.append("g")
      .attr("class", "axis axis--y")
      .attr("transform", "translate( " + widthStock + ", 0 )")
      .call(d3.axisRight(y))
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -15)
      .attr("x",-90)
      .attr("dy", "0.71em")
      .attr("fill", "#000")
      .text("USD");
      
    gMacd.append("g")
      .attr("class", "axis axis--y")
      .attr("transform", "translate( " + widthMacd + ", 0 )")
      .call(d3.axisRight(y2));

  var macdAndTrigger = gMacd.selectAll(".macdAndTrigger")
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
      .style("stroke", function(d) { return z(d.id); })
      .text(function(d) { return d.id; });
      
var price = gStock.selectAll(".price")
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
      .style("stroke", function(d) { return z(d.id); })
      .text(function(d) { return d.id; });
      
    //Plot crossover lines
var crossoversStock = gStock.selectAll(".crossover")
    .data(crosses)
    .enter().append("g")
      .attr("class", "crossover");
  crossoversStock.append("line")
      .attr("class", "crossline")
      .attr("x1", function(d) { return x(d.date); })
      .attr("x2", function(d) { return x(d.date); })
      .attr("y1", y.range()[0])
      .attr("y2", y.range()[1])
      .attr("stroke-width","1")
      .attr("stroke-dasharray","2,2")
      .attr("stroke", function(d) { return d.bullish?"green":"red"; });
  var crossoversMacd = gMacd.selectAll(".crossover")
    .data(crosses)
    .enter().append("g")
      .attr("class", "crossover");
  crossoversMacd.append("line")
      .attr("class", "crossline")
      .attr("x1", function(d) { return x(d.date); })
      .attr("x2", function(d) { return x(d.date); })
      .attr("y1", y2.range()[0])
      .attr("y2", y2.range()[1])
      .attr("stroke-width","1")
      .attr("stroke-dasharray","2,2")
      .attr("stroke", function(d) { return d.bullish?"green":"red"; });

}