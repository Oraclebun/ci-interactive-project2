//main javascript file to validate forms, do api calls, create/ init data, handle click, resize events

//declare chart variables
const expRowChart = new dc.RowChart("#row-chart", "group1");
const expPieChart = new dc.PieChart("#pie-chart", "group1");
const multichart = new dc.SeriesChart("#line-chart", "group2");
let rowColor = d3.scaleOrdinal(
  d3.quantize(d3.interpolateHcl("#2d5235", "#7bb788"), 9)
);
let jsonArr = [];         //initialize array to hold json objects
let genRan = false;       //initialize genRan to false

$(function () {
  //Sidebar toggle on click
  $(".sidebarToggle").on("click", function (e) {
    e.preventDefault();
    $(".sidebar").toggleClass("toggled");
  });

  //set date header for table-form
  $("#table-form tr:first th:last-child").html(moment().format("MMM YY"));
  $("#table-form tr:first th:nth-last-child(2)").html(
    moment().subtract(1, "months").format("MMM YY")
  );
  $("#table-form tr:first th:nth-last-child(3)").html(
    moment().subtract(2, "months").format("MMM YY")
  );
  $("#table-form tr:first th:nth-last-child(4)").html(
    moment().subtract(3, "months").format("MMM YY")
  );
  $("#table-form tr:first th:nth-last-child(5)").html(
    moment().subtract(4, "months").format("MMM YY")
  );
  $("#table-form tr:first th:nth-last-child(6)").html(
    moment().subtract(5, "months").format("MMM YY")
  );

  //disallow e,+ and - in form input (Household Expenditure forms)
  $("input[type=number]").keypress(function (evt) {
    if (evt.charCode == 45 || evt.charCode == 43 || evt.charCode == 101) {
      alert("Keys are not accepted");
      evt.preventDefault();
    }
  });

  //Expenditure Tracking Form validation - disallow non-digit characters, space
  $(".formData").keypress(function (e) {
    let char = e.key;
    if ((isNaN(char) || e.which == 32) && char !== ".") {
      e.preventDefault();
    }
  });

  //variables for table and pie and row chart
  let tableData, expData;

  //API settings - data for grouped bar chart and table
  var settings1 = {
    async: true,
    crossDomain: true,
    url: "https://sghouseholdexp17-9d5c.restdb.io/rest/hes-table2-27",
    method: "GET",
    headers: {
      "content-type": "application/json",
      "x-apikey": "5ea6e1fa96bed7493503627c",
      "cache-control": "no-cache",
    },
  };

  // API settings - data for doughnut chart and horizontal row chart.
  var settings2 = {
    async: true,
    crossDomain: true,
    url: "https://sghouseholdexp17-9d5c.restdb.io/rest/hes-table16a",
    method: "GET",
    headers: {
      "content-type": "application/json",
      "x-apikey": "5ea6e1fa96bed7493503627c",
      "cache-control": "no-cache",
    },
  };

  if (storageAvailable("localStorage")) {
    // localStorage is availables
    let doFirst = getData("localStorage", "tableData", settings1);
    let doSecond = getData("localStorage", "expData", settings2);

    $.when(doFirst, doSecond).done(function (data1, data2) {
      tableData = data1; // "5 objs"
      expData = data2; // "54 objs"

      if (localStorage.getItem("trackData")) {
        console.log("Getting from storage");
        jsonArr = JSON.parse(localStorage.getItem("trackData"));
      } else {
        genRan = true; // generate random data
        jsonArr = tabletoJSON("#table-form");
      }

      //create crossfilter dimension for expData
      let ndx = crossfilter(expData),
        quintDim = ndx.dimension(function (d) {
          return d.quintile;
        }),
        filteredQuint = quintDim.filter(quintile),
        byCat = filteredQuint.top(Infinity);

      //crossfilter dimension for expData filtered by income quintile
      let tempndx = crossfilter(byCat),
        catDim = tempndx.dimension(function (d) {
          return d.category;
        }),
        sourceDim = tempndx.dimension(function (d) {
          return d.source;
        }),
        spendPerCat = catDim.group().reduceSum(function (d) {
          return +d.spending;
        }),
        spendPerSource = sourceDim.group().reduceSum(function (d) {
          return +d.spending;
        });

      //create date object from date data in JSON object
      let parsedDate = d3.timeParse("%d-%m-%y");
      jsonArr.forEach(function (d) {
        d.parsed = parsedDate(d.date);
      });

      //create crossfilter dimension for expenditure tracking form data (jsonArr)
      let cfx = crossfilter(jsonArr),
        catdateDimension = cfx.dimension(function (d) {
          return [d.categories, d.parsed];
        }),
        dateDimension = cfx.dimension(function (d) {
          return d.parsed;
        }),
        catdateGroup = catdateDimension.group().reduceSum(function (d) {
          return +d.spending;
        }),
        minDate = dateDimension.bottom(1)[0].parsed,
        maxDate = dateDimension.top(1)[0].parsed,
        minStrDate = moment(minDate),
        maxStrDate = moment(maxDate).add(1, "months");

      pushToTable(tableData); //push API data to table
      drawBar(tableData); //draw grouped bar chart from data

      renderPieRow(
        expRowChart,
        expPieChart,
        catDim,
        sourceDim,
        spendPerCat,
        spendPerSource
      ); //draw doughnut and chart
      renderSeries(
        multichart,
        catdateDimension,
        catdateGroup,
        minStrDate,
        maxStrDate
      ); //draw Series chart from user data

      dc.renderAll("group1");   //render group 1 chart first (doughnut and horizontal)
      dc.renderAll("group2");   //then render group 2 chart (series chart)

      //window on resize, re populate table with data, redraw grouped barchart and redraw doughnut, horizontal bar and series chart

      $(window).resize(function () {
        pushToTable(tableData);   
        drawBar(tableData);
        chart_display(expRowChart, expPieChart, multichart);
      });

      //submit button click event (for household expenditure form)
      $("#submit").click(function (e) {
        let a = $("input[name=foodBeverage]").val(),
          b = $("input[name=housingUtils]").val(),
          c = $("input[name=health]").val(),
          d = $("input[name=transport]").val(),
          f = $("input[name=communication").val(),
          g = $("input[name=recreation").val(),
          h = $("input[name=education").val(),
          i = $("input[name=foodServices").val(),
          j = $("input[name=misc").val();

        if (
          !a.length ||
          !b.length ||
          !c.length ||
          !d.length ||
          !f.length ||
          !g.length ||
          !h.length ||
          !i.length ||
          !j.length ||
          a == 0 ||
          b == 0 ||
          c == 0 ||
          d == 0 ||
          f == 0 ||
          g == 0 ||
          h == 0 ||
          i == 0 ||
          j == 0
        ) {
          e.preventDefault();
        } else {
          quintile = $("select[name=userQuintile").val();
          filteredQuint = quintDim.filter(null);
          populateVar(expData);
          ndx.remove();
          ndx.add(expData);
          filteredQuint = quintDim.filter(quintile);
          byCat = filteredQuint.top(Infinity);
          setTimeout(function () {
            tempndx.remove();
            tempndx.add(byCat);
            rowColor = d3.scaleOrdinal(
              d3.quantize(d3.interpolateHcl("#2452d5", "#7bb788"), 9)
            );
            expRowChart.colors(rowColor);
            dc.redrawAll("group1");
          }, 1500);
        }
        $("#formModal").modal("hide");
      });

      //edit button click event for expenditure tracking form
      $("#edit").click(function (e) {
        let editable = $(".formData").attr("contenteditable");
        if (editable == "false") {
          $(".formData").attr("contenteditable", "true");
        } else {
          $(".formData").attr("contenteditable", "false");
        }
      });

      //save button click event for expenditure tracking form
      $("#save").click(function (e) {
        $(".formData").attr("contenteditable", "false");
        genRan = false;
        //if table-form has empty string, replace it with 0
        $("#table-form tbody tr td").each(function () {
          if (this.innerText == "") {
            this.innerText = "0";
          }
        });
        //push table-form data to json objects
        jsonArr = tabletoJSON("#table-form");
        localStorage.setItem("trackData", JSON.stringify(jsonArr)); //keep in local storage
        $("#expHistoryform").modal("hide");

        //create parsed dates from dates in jsonArr
        jsonArr.forEach(function (d) {
          d.parsed = parsedDate(d.date);
        });

        //remove old crossfilter data and replace with new data, redraw all group 2 chart
        setTimeout(function () {
          cfx.remove();
          cfx.add(jsonArr);
          dc.redrawAll("group2");
        }, 1500);
      });
    }); //end ajax
  } else {
    // Try to use session storage
    console.log("LocalStorage Unavailable");
    let doFirst = getData("sessionStorage", "tableData", settings1);
    let doSecond = getData("sessionStorage", "expData", settings2);

    //repeat function calls for session storage
    $.when(doFirst, doSecond).done(function (data1, data2) {
      tableData = data1; // "5 objs"
      expData = data2; // "54 objs"

      if (localStorage.getItem("trackData")) {
        console.log("Getting from storage");
        jsonArr = JSON.parse(localStorage.getItem("trackData"));
      } else {
        genRan = true; // generate random data
        jsonArr = tabletoJSON("#table-form");
      }

      let ndx = crossfilter(expData),
        quintDim = ndx.dimension(function (d) {
          return d.quintile;
        }),
        filteredQuint = quintDim.filter(quintile),
        byCat = filteredQuint.top(Infinity);

      let tempndx = crossfilter(byCat),
        catDim = tempndx.dimension(function (d) {
          return d.category;
        }),
        sourceDim = tempndx.dimension(function (d) {
          return d.source;
        }),
        spendPerCat = catDim.group().reduceSum(function (d) {
          return +d.spending;
        }),
        spendPerSource = sourceDim.group().reduceSum(function (d) {
          return +d.spending;
        });

      let parsedDate = d3.timeParse("%d-%m-%y");
      jsonArr.forEach(function (d) {
        d.parsed = parsedDate(d.date);
      });

      let cfx = crossfilter(jsonArr),
        catdateDimension = cfx.dimension(function (d) {
          return [d.categories, d.parsed];
        }),
        dateDimension = cfx.dimension(function (d) {
          return d.parsed;
        }),
        catdateGroup = catdateDimension.group().reduceSum(function (d) {
          return +d.spending;
        }),
        minDate = dateDimension.bottom(1)[0].parsed,
        maxDate = dateDimension.top(1)[0].parsed,
        minStrDate = moment(minDate),
        maxStrDate = moment(maxDate).add(1, "months");

      pushToTable(tableData);
      drawBar(tableData);

      renderPieRow(
        expRowChart,
        expPieChart,
        catDim,
        sourceDim,
        spendPerCat,
        spendPerSource
      );
      renderSeries(
        multichart,
        catdateDimension,
        catdateGroup,
        minStrDate,
        maxStrDate
      );

      dc.renderAll("group1");
      dc.renderAll("group2");

      //window on resize, re populate table with data, redraw grouped barchart and redraw doughnut, horizontal bar and series chart
      $(window).resize(function () {
        pushToTable(tableData);
        drawBar(tableData);
        chart_display(expRowChart, expPieChart, multichart);
      });

      //submit button click event (for household expenditure form)
      $("#submit").click(function (e) {
        let a = $("input[name=foodBeverage]").val(),
          b = $("input[name=housingUtils]").val(),
          c = $("input[name=health]").val(),
          d = $("input[name=transport]").val(),
          f = $("input[name=communication").val(),
          g = $("input[name=recreation").val(),
          h = $("input[name=education").val(),
          i = $("input[name=foodServices").val(),
          j = $("input[name=misc").val();

        if (
          !a.length ||
          !b.length ||
          !c.length ||
          !d.length ||
          !f.length ||
          !g.length ||
          !h.length ||
          !i.length ||
          !j.length ||
          a == 0 ||
          b == 0 ||
          c == 0 ||
          d == 0 ||
          f == 0 ||
          g == 0 ||
          h == 0 ||
          i == 0 ||
          j == 0
        ) {
          e.preventDefault();
        } else {
          quintile = $("select[name=userQuintile").val();
          filteredQuint = quintDim.filter(null);
          populateVar(expData);
          ndx.remove();
          ndx.add(expData);
          filteredQuint = quintDim.filter(quintile);
          byCat = filteredQuint.top(Infinity);
          setTimeout(function () {
            tempndx.remove();
            tempndx.add(byCat);
            rowColor = d3.scaleOrdinal(
              d3.quantize(d3.interpolateHcl("#2452d5", "#7bb788"), 9)
            );
            expRowChart.colors(rowColor);
            dc.redrawAll("group1");
          }, 1500);
        }

        $("#formModal").modal("hide");
      });

      //edit button click event ( for expenditure tracking form)
      $("#edit").click(function (e) {
        let editable = $(".formData").attr("contenteditable");
        if (editable == "false") {
          $(".formData").attr("contenteditable", "true");
        } else {
          $(".formData").attr("contenteditable", "false");
        }
      });

      //save button click event
      $("#save").click(function (e) {
        $(".formData").attr("contenteditable", "false");
        genRan = false;
        $("#table-form tbody tr td").each(function () {
          if (this.innerText == "") {
            this.innerText = "0";
          }
        });

        jsonArr = tabletoJSON("#table-form");
        localStorage.setItem("trackData", JSON.stringify(jsonArr)); //keep in local storage
        $("#expHistoryform").modal("hide");

        jsonArr.forEach(function (d) {
          d.parsed = parsedDate(d.date);
        });

        setTimeout(function () {
          cfx.remove();
          cfx.add(jsonArr);
          dc.redrawAll("group2");
        }, 1500);
      });
    }); //end ajax
  }
}); //end jQuery document ready
