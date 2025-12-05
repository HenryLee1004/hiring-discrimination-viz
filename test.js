//1) create the svg frame
const width = 600;
const height = 400;
const margin = 60;


//scales of x and y; in my case should be fine. y scale is like percentage

let x = d3.scaleBand(
  [],
  [margin, width - margin]
).padding(0.2);

const y = d3.scaleLinear()
  .domain([0, 0.3])
  .range([height - margin, margin]);

const color = d3.scaleOrdinal()
  .domain(["white", "black"])
  .range(["steelblue", "orange"]);

const tooltip = d3.select("#tooltip");

const svg = d3.select("#chart")
  .attr("width", width)
  .attr("height", height);


//x-axis and y-axs

svg.append("g")
  .attr("class", "x-axis")
  .attr("transform", `translate(0,${height - margin})`);

svg.append("g")
  .attr("class", "y-axis")
  .attr("transform", `translate(${margin},0)`)
  .call(d3.axisLeft(y).tickFormat(d => d3.format(".0%")(d)));



//need a hoverline object here
const hoverLine = svg.append("line")
  .attr("class", "hover-line")
  .attr("stroke", "black")
  .attr("stroke-dasharray", "4 4")
  .attr("stroke-width", 1)
  .style("opacity", 1);


//implement the hoverline on the svg
svg
  .on("mousemove", function (event) {
    // Mouse position inside the SVG
    const [sx, sy] = d3.pointer(event, this);

    // make it so that the line only shows within the plotting rnage of the graph
    if (sy < margin || sy > height - margin) {
      hoverLine.style("opacity", 0);
      return;
    }

    hoverLine
      .attr("x1", margin)
      .attr("x2", width - margin)
      .attr("y1", sy - 1)
      .attr("y2", sy - 1)
      .style("opacity", 1);
  })
  .on("mouseleave", function () {
    hoverLine.style("opacity", 0);
  });

//add titles and x and y axes labels
svg.append("text")
  .attr("class", "chart-title")
  .attr("x", width / 2)
  .attr("y", margin / 2)
  .attr("text-anchor", "middle")
  .attr("font-size", "20px")
  .attr("font-weight", "bold")
  .text("");

//title changes dynamicsally based on the comparison group
function updateTitle() {
  const title = condition_by_sex
    ? "Callback Rates by Ethnicity and Sex"
    : "Callback Rates by Ethnicity";

  svg.select(".chart-title").text(title);
}

//also x and y axis labels
svg.append("text")
  .attr("class", "x-axis-title")
  .attr("x", width / 2)
  .attr("y", height - margin / 4)
  .attr("text-anchor", "middle")
  .attr("font-size", "14px")
  .text("Job Applicants (Shown by resume)");

svg.append("text")
  .attr("class", "y-axis-title")
  .attr("transform", "rotate(-90)")
  .attr("x", -height / 2)
  .attr("y", margin / 3)
  .attr("text-anchor", "middle")
  .attr("font-size", "14px")
  .attr("font-weight", "bold")
  .text("Resume Callback Rates");



//95% interval note to explain what it is 
const ciExplanation = svg.append("foreignObject")
  .attr("class", "ci-explanation")
  .attr("x", margin)
  .attr("y", margin - 20)
  .attr("width", width - margin * 2)
  .attr("height", 70)
  .append("xhtml:div")
  .style("font-size", "13px")
  .style("color", "black")
  .style("text-align", "center")
  .style("line-height", "1.3")
  .style("width", "100%")
  .html(`
 
    <em>*Note:</em>  <strong>The error bars mark the  
      <a href="https://www.pewresearch.org/decoded/2025/09/16/understanding-error-bars-in-charts/"
         target="_blank"
         style="color: blue; text-decoration: underline;">
         95% Confidence Interval</a>, which shows how much the callback 
      rate could vary if the study were repeated many times. Smaller samples (n) tend to have wider variation.
       </strong>
    `);

//2) prep to load data to create bar charts. 
let allRows = [];
let barData = [];


//state object that records every variable 
let state = {
  collegeOnly: false,
  nocollegeOnly: false,

  computerSkills: false,
  nocomputerSkills: false,

  honorsOnly: false,
  nohonorsOnly: false,

  volunteerOnly: false,
  novolunteerOnly: false,

  jobsEnabled: false,
  minJobs: 0,
  maxJobs: 50,

  expEnabled: false,
  minExp: 0,
  maxExp: 50,

  eoeOnly: false,
  noeoeOnly: false,
  reqExpOnly: false,
  noreqExpOnly: false,

  reqCommOnly: false,
  noreqCommOnly: false,

  reqEducOnly: false,
  noreqEducOnly: false,

  reqCompOnly: false,
  noreqCompOnly: false,

  reqOrgOnly: false,
  noreqOrgOnly: false,

  minExpReqEnabled: false,
  maxMinExpReq: 50,

  selectedWanted: new Set(),
  selectedIndustries: new Set()
};

// clean up industry variable a bit cuz some industries have too small sample 
// -->  merged into the same bucket as "unknown"
const SMALL_INDUSTRIES = new Set([
  "transport/communication",
  "finance/insurance/real estate",

  "health/education/social services"


].map(s => s.toLowerCase()));

function normalizeIndustry(rawIndustry) {
  if (!rawIndustry) {
    return "unknown";
  }

  const cleaned = rawIndustry.trim();
  const lower = cleaned.toLowerCase();


  if (lower === "unknown" || SMALL_INDUSTRIES.has(lower)) {
    return "unknown";
  }

  return cleaned;
}


//helper function that implements the slider
function connectTriSlider(id, negativeKey, positiveKey) {
  d3.select(id).on("input", function () {
    const v = +this.value;

    // Reset both sides
    state[negativeKey] = false;
    state[positiveKey] = false;

    if (v === 0) state[negativeKey] = true;  // left side
    if (v === 2) state[positiveKey] = true;  // right side

    updateRender();
  });
}

//apply slider to vairables
connectTriSlider("#college-slider", "nocollegeOnly", "collegeOnly");
connectTriSlider("#computer-slider", "nocomputerSkills", "computerSkills");
connectTriSlider("#honors-slider", "nohonorsOnly", "honorsOnly");
connectTriSlider("#volunteer-slider", "novolunteerOnly", "volunteerOnly");
connectTriSlider("#eoe-slider", "noeoeOnly", "eoeOnly");
connectTriSlider("#reqexp-slider", "noreqExpOnly", "reqExpOnly");
connectTriSlider("#reqcomm-slider",
  "noreqCommOnly", "reqCommOnly");
connectTriSlider("#reqeduc-slider", "noreqEducOnly", "reqEducOnly");
connectTriSlider("#reqcomp-slider", "noreqCompOnly", "reqCompOnly");
connectTriSlider("#reqorg-slider", "noreqOrgOnly",
  "reqOrgOnly");


//helper function of filter (based on what the state is)

function apply_filter(data) {
  let filtered = data;

  // resume related filters
  if (state.collegeOnly) filtered = filtered.filter(r => r.College === "yes");
  if (state.nocollegeOnly) filtered = filtered.filter(r => r.College !== "yes");

  if (state.computerSkills) filtered = filtered.filter(r => r.Computer === 1);
  if (state.nocomputerSkills) filtered = filtered.filter(r => r.Computer !== 1);

  if (state.honorsOnly) filtered = filtered.filter(r => r.Honors === 1);
  if (state.nohonorsOnly) filtered = filtered.filter(r => r.Honors !== 1);

  if (state.volunteerOnly) filtered = filtered.filter(r => r.Volunteer === 1);
  if (state.novolunteerOnly) filtered = filtered.filter(r => r.Volunteer !== 1);

  if (state.jobsEnabled)
    filtered = filtered.filter(r => r.Jobs >= state.minJobs && r.Jobs <= state.maxJobs);

  if (state.expEnabled)
    filtered = filtered.filter(r => r.Experience >= state.minExp && r.Experience <= state.maxExp);

  // Employer related filters
  if (state.eoeOnly) filtered = filtered.filter(r => r.EOE === 1);
  if (state.noeoeOnly) filtered = filtered.filter(r => r.EOE !== 1);

  if (state.reqExpOnly) filtered = filtered.filter(r => r.ReqExp === 1);
  if (state.noreqExpOnly) filtered = filtered.filter(r => r.ReqExp !== 1);

  if (state.reqCommOnly) filtered = filtered.filter(r => r.ReqComm === 1);
  if (state.noreqCommOnly) filtered = filtered.filter(r => r.ReqComm !== 1);

  if (state.reqEducOnly) filtered = filtered.filter(r => r.ReqEduc === 1);
  if (state.noreqEducOnly) filtered = filtered.filter(r => r.ReqEduc !== 1);

  if (state.reqCompOnly) filtered = filtered.filter(r => r.ReqComp === 1);
  if (state.noreqCompOnly) filtered = filtered.filter(r => r.ReqComp !== 1);

  if (state.reqOrgOnly) filtered = filtered.filter(r => r.ReqOrg === 1);
  if (state.noreqOrgOnly) filtered = filtered.filter(r => r.ReqOrg !== 1);

  if (state.minExpReqEnabled)
    filtered = filtered.filter(r => r.MinExpReq <= state.maxMinExpReq);

  if (state.selectedWanted.size > 0)
    filtered = filtered.filter(r => state.selectedWanted.has(r.Wanted));

  if (state.selectedIndustries.size > 0)
    filtered = filtered.filter(r => state.selectedIndustries.has(r.Industry));

  return filtered;
}

//helper for CI 95%
function computeCI(count, total) {
  if (total === 0) return { low: 0, high: 0 };

  const p = count / total;
  const se = Math.sqrt(p * (1 - p) / total);
  const moe = 1.96 * se;

  return { low: p - moe, high: p + moe };
}

//update data and render the bar chart based on comparison groups
let condition_by_sex = false

d3.select("#compare_what").on("input", function () {
  condition_by_sex = !condition_by_sex;
  updateRender();
});


function updateRender() {
  const filtered = apply_filter(allRows);

  // if race only

  if (!condition_by_sex) {
    const groups = [
      { key: "White", Ethnicity: "white" },
      { key: "Black", Ethnicity: "black" }
    ];

    barData = groups.map(g => {
      const total = filtered.filter(d => d.Ethnicity === g.Ethnicity).length;
      const calls = filtered.filter(d => d.Ethnicity === g.Ethnicity && d.Call === 1).length;
      const ci = computeCI(calls, total);

      return {
        group: g.key,
        total,
        calls,
        value: total === 0 ? 0 : calls / total,
        ciLow: ci.low,
        ciHigh: ci.high
      };
    });
  }

  // if race + sex

  else {
    const groups = [
      { key: "White-males", Gender: "male", Ethnicity: "white" },
      { key: "White-females", Gender: "female", Ethnicity: "white" },
      { key: "Black-males", Gender: "male", Ethnicity: "black" },
      { key: "Black-females", Gender: "female", Ethnicity: "black" }
    ];



    barData = groups.map(g => {
      const total = filtered.filter(d =>
        d.Gender === g.Gender && d.Ethnicity === g.Ethnicity
      ).length;

      const calls = filtered.filter(d =>
        d.Gender === g.Gender && d.Ethnicity === g.Ethnicity && d.Call === 1
      ).length;

      const ci = computeCI(calls, total);

      return {
        group: g.key,
        total,
        calls,
        value: total === 0 ? 0 : calls / total,
        ciLow: ci.low,
        ciHigh: ci.high
      };
    });
  }
  //update x axis based on comparison groups
  x.domain(barData.map(d => d.group));
  svg.select(".x-axis")
    .call(d3.axisBottom(x));



  //cancel chart if sample too small
  const tooSmall = barData.some(d => d.total < 30);

  if (tooSmall) {
    svg.selectAll(".bar").remove();
    svg.selectAll(".ci-line").remove();
    svg.selectAll(".ci-top").remove();
    svg.selectAll(".ci-bottom").remove();
    svg.selectAll(".bar-label").remove();
    svg.selectAll(".ci-top-label").remove();
    svg.selectAll(".ci-low-label").remove();

    d3.select("#small-sample-msg")
      .style("display", "block")
      .text("One group has sample size < 30. Too small to display meaningful comparison.");

    return;
  } else {
    d3.select("#small-sample-msg").style("display", "none");
  }
  updateTitle();
  draw_chart();
}


//draw the actual chart 

function draw_chart() {
  // remove everything first
  svg.selectAll(".bar, .ci-line, .ci-top, .ci-bottom, .ci-top-label, .ci-low-label, .bar-label").remove();


  svg.selectAll(".bar")
    .data(barData)
    .join("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.group))
    .attr("y", d => y(d.value))
    .attr("width", x.bandwidth())
    .attr("height", d => y(0) - y(d.value))
    .attr("fill", d => color(d.group.split("-")[0].toLowerCase()))
    .on("mousemove", (event, d) => {
      tooltip
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY + 10 + "px")
        .style("display", "block")
        //tool tip needs to have title, ci, rate, and also count
        .html(`
            <strong>${d.group}</strong><br>
            Callback rate: ${(d.value * 100).toFixed(1)}%<br>
            ${d.calls} callbacks out of ${d.total}
          `);
    })
    .on("mouseleave", () => tooltip.style("display", "none"));

  //  95% CI: ${(d.ciLow * 100).toFixed(1)}% – ${(d.ciHigh * 100).toFixed(1)}%<br>


  //draw a new bar for the CI

  /*
    svg.selectAll(".ci-fill")
      .data(barData)
      .join("rect")
      .attr("class", "ci-fill")
      .attr("x", d => x(d.group))
      .attr("width", x.bandwidth())
      .attr("y", d => y(d.ciHigh))
      .attr("height", d => y(d.ciLow) - y(d.ciHigh))
      .attr("fill", d => d3.color(color(d.group.split("-")[0].toLowerCase())).brighter(1.8))
      .attr("opacity", 0.35);
  
    svg.selectAll(".ci-fill").raise();
  */

  //draw CI Vertical line

  svg.selectAll(".ci-line")
    .data(barData)
    .join("line")
    .attr("class", "ci-line")
    .attr("x1", d => x(d.group) + x.bandwidth() / 2)
    .attr("x2", d => x(d.group) + x.bandwidth() / 2)
    .attr("y1", d => y(d.ciHigh))
    .attr("y2", d => y(d.ciLow))
    .attr("stroke", "black")
    .attr("stroke-width", 2);


  //draw CI top horizontal 
  svg.selectAll(".ci-top")
    .data(barData)
    .join("line")
    .attr("class", "ci-top")
    .attr("x1", d => x(d.group) + x.bandwidth() / 2 - 8)
    .attr("x2", d => x(d.group) + x.bandwidth() / 2 + 8)
    .attr("y1", d => y(d.ciHigh))
    .attr("y2", d => y(d.ciHigh))
    .attr("stroke", "black")
    .attr("stroke-width", 2);
  //provide label
  svg.selectAll(".ci-top-label")
    .data(barData)
    .join("text")
    .attr("class", "ci-top-label")
    .attr("x", d => x(d.group) + x.bandwidth() / 2 + 12)
    .attr("y", d => y(d.ciHigh) + 4)
    .attr("text-anchor", "start")
    .attr("font-size", "11px")
    .attr("fill", "black")
    .text(d => (d.ciHigh * 100).toFixed(1) + "%");


  // draw ci bottom same as top
  svg.selectAll(".ci-bottom")
    .data(barData.filter(d => d.ciLow > 0))
    .join("line")
    .attr("class", "ci-bottom")
    .attr("x1", d => x(d.group) + x.bandwidth() / 2 - 8)
    .attr("x2", d => x(d.group) + x.bandwidth() / 2 + 8)
    .attr("y1", d => y(d.ciLow))
    .attr("y2", d => y(d.ciLow))
    .attr("stroke", "black")
    .attr("stroke-width", 2)

  // CI lower text label
  svg.selectAll(".ci-low-label")
    .data(barData.filter(d => d.ciLow > 0))
    .join("text")
    .attr("class", "ci-low-label")
    .attr("x", d => x(d.group) + x.bandwidth() / 2 + 12)
    .attr("y", d => y(d.ciLow) + 4)
    .attr("text-anchor", "start")
    .attr("font-size", "11px")
    .attr("fill", "black")
    .text(d => (d.ciLow * 100).toFixed(1) + "%");


  //need to make sure they are above bar plots

  svg.select(".hover-line").raise();
  svg.select(".ci-low-label").raise();
  svg.selectAll(".ci-line, .ci-top, .ci-bottom").raise();


  svg.selectAll(".sample-label")
    .data(barData)
    .join("text")
    .attr("class", "sample-label")
    .attr("x", d => x(d.group) + x.bandwidth() / 2)
    .attr("y", height - margin + 30)   // BELOW the x-axis
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("fill", "black")
    .text(d => `n = ${d.total}`);

}


//load data takes time
d3.csv("ResumeNames.csv").then(raw => {

  allRows = raw.map(d => ({
    Gender: d.gender,
    Ethnicity: d.ethnicity,
    Call: d.call === "yes" ? 1 : 0,

    Jobs: +d.jobs,
    Experience: +d["work experience (yrs)"],
    Honors: d.honors === "yes" ? 1 : 0,
    Volunteer: d.volunteer === "yes" ? 1 : 0,
    Computer: d.computer === "yes" ? 1 : 0,
    College: d.college,

    MinExpReq: +d["minimum exp required"],
    EOE: d["equal opportunity employment"] === "yes" ? 1 : 0,

    Wanted: d["type of position wanted"],
    Industry: normalizeIndustry(d.industry),

    ReqEduc: d["require education"] === "yes" ? 1 : 0,
    ReqComp: d["require computer skills"] === "yes" ? 1 : 0,
    ReqComm: d["require communication skills"] === "yes" ? 1 : 0,

    ReqOrg: d["require organizational skills"] === "yes" ? 1 : 0,
    ReqExp: d["require experience"] === "yes" ? 1 : 0
  }));

  //industry needs to have dropdown
  const wantedValues = Array.from(new Set(allRows.map(d => d.Wanted)));
  const industryValues = Array.from(new Set(allRows.map(d => d.Industry)));


  const industrySelect = d3.select("#industry-filter");


  industrySelect
    .append("option")
    .attr("value", "")
    .text("All industries");
  industryValues.forEach(v => {
    industrySelect
      .append("option")
      .attr("value", v)
      .text(v);
  });
  wantedValues.forEach(v =>
    d3.select("#wanted-filter")
      .append("option")
      .attr("value", v)
      .text(v)
  );



  updateRender();
});

//connecting user interaction
d3.select("#jobs-enable").on("change", function () {
  state.jobsEnabled = this.checked;
  updateRender();
});

d3.select("#jobs-min").on("input", function () {
  state.minJobs = +this.value;
  if (state.jobsEnabled) updateRender();
});

d3.select("#jobs-max").on("input", function () {
  state.maxJobs = +this.value;
  if (state.jobsEnabled) updateRender();
});

d3.select("#exp-enable").on("change", function () {
  state.expEnabled = this.checked;
  updateRender();
});

d3.select("#exp-min").on("input", function () {
  state.minExp = +this.value;
  if (state.expEnabled) updateRender();
});

d3.select("#exp-max").on("input", function () {
  state.maxExp = +this.value;
  if (state.expEnabled) updateRender();
});

d3.select("#minexp-enable").on("change", function () {
  state.minExpReqEnabled = this.checked;
  updateRender();
});

d3.select("#minexp-max").on("input", function () {
  state.maxMinExpReq = +this.value;
  if (state.minExpReqEnabled) updateRender();
});

function getMultiSelectValues(selectEl) {
  return new Set([...selectEl.selectedOptions].map(o => o.value));
}

d3.select("#wanted-filter").on("change", function () {
  state.selectedWanted = getMultiSelectValues(this);
  updateRender();
});

d3.select("#industry-filter").on("change", function () {
  const value = this.value;

  if (!value) {
    state.selectedIndustries = new Set();
  } else {
    state.selectedIndustries = new Set([value]);
  }

  updateRender();
});

