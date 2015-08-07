function elt(name, attributes) {
	var node = document.createElement(name);
	if(attributes) {
		for(var attr in attributes) {
			if(attributes.hasOwnProperty(attr))
				node.setAttribute(attr, attributes[attr]);
		}
	}
	for(var i = 2; i < arguments.length; i++) {
		var child = arguments[i];
		if(typeof child == "string")
			child = document.createTextNode(child);
		node.appendChild(child);
	}
	return node;
}

var controls = Object.create(null);

function createPaint(parent) {
	var canvas = elt("canvas", {width: 500, height: 300});
	var cx = canvas.getContext("2d");
	var toolbar = elt("div", {class: "toolbar"});
	for(var name in controls)
		toolbar.appendChild(controls[name](cx));
	var panel = elt("div", {class: "picturepanel"}, canvas);
	parent.appendChild(elt("div", null, panel, toolbar));
}

var tools = Object.create(null);

controls.tool = function(cx) {
	var select= elt("select");
	for(var name in tools)
		select.appendChild(elt("option", null, name));

	cx.canvas.addEventListener("mousedown", function(event) {
		if(event.which == 1) {
			tools[select.value](event, cx);
			event.preventDefault();
		}
	});
	return elt("span", null, "Tool: ", select);
};
function relativePos(event, element) {
	var rect = element.getBoundingClientRect();
	return {x: Math.floor(event.clientX - rect.left),
			y: Math.floor(event.clientY - rect.top)};
};
function trackDrag(onMove, onEnd) {
	function end(event) {
		removeEventListener("mousemove", onMove);
		removeEventListener("mouseup", end);
		if(onEnd)
			onEnd(event);
	}
	addEventListener("mousemove", onMove);
	addEventListener("mouseup", end);
};
tools.Line = function(event, cx, onEnd) {
	cx.lineCap = "round";

	var pos = relativePos(event, cx.canvas);
	trackDrag(function(event) {
		cx.beginPath();
		cx.moveTo(pos.x, pos.y);
		pos = relativePos(event, cx.canvas);
		cx.lineTo(pos.x, pos.y);
		cx.stroke();
	}, onEnd);
};
tools.Erase = function(event, cx) {
	cx.globalCompositeOperation = "destination-out";
	tools.Line(event, cx, function() {
		cx.globalCompositeOperation = "source-over";
	});
};

controls.color = function(cx) {
	var input = elt("input", {type: "color"});
	input.addEventListener("change", function() {
		cx.fillStyle = input.value;
		cx.strokeStyle = input.value;
	});
	return elt("span", null, "Color: ", input);
};

controls.brushSize = function(cx) {
	var select = elt("select");
	var sizes = [1, 2, 3, 5, 8, 12, 25, 35, 50, 75, 100];
	sizes.forEach(function(size) {
		select.appendChild(elt("option", {value: size}, size + " pixels"));
	});
	select.addEventListener("change", function() {
		cx.lineWidth = select.value;
	});
	return elt("span", null, "Brush size: ", select);
};

controls.save = function(cx) {
	var link = elt("a", {herf: "/"}, "Save");
	function update() {
		try {
			link.href = cx.canvas.toDataURL();
		} catch(e) {
			if(e instanceof SecurityError)
				link.href = "javascript:alert(" + JSON.stringify("Can't save: " + e.toString()) + ")";
			else
				throw e;
		}
	}
	link.addEventListener("mouseover", update);
	link.addEventListener("focus", update);
	return link;
};

function loadImageURL(cx, url) {
	var image = document.createElement("img");
	image.addEventListener("load", function() {
		var color = cx.fillStyle, size = cx.lineWidth;
		cx.canvas.width = image.width;
		cx.canvas.height = image.height;
		cx.drawImage(image, 0, 0);
		cx.fillStyle = color;
		cx.lineWidth = size;
	});
	image.src = url;
};

controls.openFile = function(cx) {
	var input = elt("input", {type: "file"});
	input.addEventListener("change", function() {
		if(input.files.length == 0) return;
		var reader = new FileReader();
		reader.addEventListener("load", function() {
			loadImageURL(cx, reader.result);
		});
		reader.readAsDataURL(input.files[0]);
	});
	return elt("div", null, "Open File: ", input);
};

controls.openURL = function(cx) {
  var input = elt("input", {type: "text"});
  var form = elt("form", null, "Open URL: ", input, elt("button", {type: "submit"}, "load"));

  form.addEventListener("submit", function(event) {
    event.preventDefault();
    loadImageURL(cx, input.value);
  });
  return form;
};

tools.Text = function(event, cx) {
  var text = prompt("Text:", "");
  if (text) {
    var pos = relativePos(event, cx.canvas);
    cx.font = Math.max(7, cx.lineWidth) + "px sans-serif";
    cx.fillText(text, pos.x, pos.y);
  }
};

tools.Spray = function(event, cx) {
  var radius = cx.lineWidth / 2;
  var area = radius * radius * Math.PI;
  var dotsPerTick = Math.ceil(area / 30);

  var currentPos = relativePos(event, cx.canvas);
  var spray = setInterval(function() {
    for (var i = 0; i < dotsPerTick; i++) {
      var offset = randomPointsInRadius(radius);
      cx.fillRect(currentPos.x + offset.x,
                  currentPos.y + offset.y, 1, 1);
    }
  }, 25);
  trackDrag(function(event) {
    currentPos = relativePos(event, cx.canvas);
  }, function() {
    clearInterval(spray);
  });
};

function randomPointsInRadius(radius) {
	for(;;) {
		var x = Math.random() * 2 - 1;
		var y = Math.random() * 2 - 1;
		if(x * x + y * y <= 1)
			return {x: x * radius, y: y * radius};
	}
}

tools.Rectangle = function(event, cx) {
	var currentPos = relativePos(event, cx.canvas);
	var startX = currentPos.x, startY = currentPos.y;
	var width = 0, height = 0;
	var tracer = document.createElement("div");
	tracer.style.position = "absolute";
	tracer.style.border = "1px dotted grey";
	tracer.style.top = event.clientY + "px";
	tracer.style.left = event.clientX + "px";
	tracer.style.width = width + "px";
	tracer.style.height = height + "px";
	cx.canvas.parentNode.appendChild(tracer);
	trackDrag(function(event) {
		var newPos = relativePos(event, cx.canvas);
		width = newPos.x - startX;
		height = newPos.y - startY;
		if(width < 0) {
			tracer.style.width = -width + "px";
			tracer.style.left = newPos.x + "px";
		} else {
			tracer.style.width = width + "px";
		}
		if(height < 0) {
			tracer.style.height = -height + "px";
			tracer.style.top = newPos.y + "px";
		} else {
			tracer.style.height = height + "px";
		}
	}, function() {
		cx.fillRect(startX, startY, width, height);
		tracer.parentNode.removeChild(tracer);
	});
};

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

tools["Pick Color"] = function(event, cx) {
    // Your code here.
    var currentPos = relativePos(event, cx.canvas);
    var pixelX = currentPos.x, pixelY = currentPos.y;
    var color = document.querySelector("[type=color]");
    try {
      var data = cx.getImageData(pixelX, pixelY, 1, 1).data;
      var r = data[0];
      var g = data[1];
      var b = data[2];
      var a = data[3];
      cx.fillStyle = "rgb(" + r + ", " + g + ", " + b + ")";
      color.value = rgbToHex(r, g, b);
    } catch(e) {
      alert(e);
    }
};


// attach the .equals method to Array's prototype to call it on any array
Array.prototype.equals = function (array) {
    // if the other array is a falsy value, return
    if (!array)
        return false;

    // compare lengths - can save a lot of time 
    if (this.length != array.length)
        return false;

    for (var i = 0, l = this.length; i < l; i++) {
        // Check if we have nested arrays
        if (this[i] instanceof Array && array[i] instanceof Array) {
            // recurse into the nested arrays
            if (!this[i].equals(array[i]))
                return false;       
        }           
        else if (this[i] != array[i]) { 
            // Warning - two different object instances will never be equal: {x:20} != {x:20}
            return false;   
        }           
    }       
    return true;
}

// A couple helper functions from the solution
  // Call a given function for all horizontal and vertical neighbors
  // of the given point.
  function forAllNeighbors(point, fn) {
    fn({x: point.x, y: point.y + 1});
    fn({x: point.x, y: point.y - 1});
    fn({x: point.x + 1, y: point.y});
    fn({x: point.x - 1, y: point.y});
  }

  // Given two positions, returns true when they hold the same color.
  function isSameColor(data, pos1, pos2) {
    var offset1 = (pos1.x + pos1.y * data.width) * 4;
    var offset2 = (pos2.x + pos2.y * data.width) * 4;
    for (var i = 0; i < 4; i++) {
      if (data.data[offset1 + i] != data.data[offset2 + i])
        return false;
    }
    return true;
  }

tools["Flood Fill"] = function(event, cx) {
	// Marjin's solution...
	var startPos = relativePos(event, cx.canvas);

    var data = cx.getImageData(0, 0, cx.canvas.width,
                               cx.canvas.height);
    // An array with one place for each pixel in the image.
    var alreadyFilled = new Array(data.width * data.height);

    // This is a list of same-colored pixel coordinates that we have
    // not handled yet.
    var workList = [startPos];
    while (workList.length) {
      var pos = workList.pop();
      var offset = pos.x + data.width * pos.y;
      if (alreadyFilled[offset]) continue;

      cx.fillRect(pos.x, pos.y, 1, 1);
      alreadyFilled[offset] = true;

      forAllNeighbors(pos, function(neighbor) {
        if (neighbor.x >= 0 && neighbor.x < data.width &&
            neighbor.y >= 0 && neighbor.y < data.height &&
            isSameColor(data, startPos, neighbor))
          workList.push(neighbor);
      });
    }

	// var width = cx.canvas.width, height = cx.canvas.height;
	// var thisX = event.clientX, thisY = event.clientY;
	// var px = new PixelGrid(cx);
	// var startingColor = px.get(thisX, thisY);

	// This is following the steps that Marjin suggests in his hint, since my initial solution was too expensive...even this was still too expensive. I guess recursive functions are a no go.
	// function processWorkList(workList) {
	// 	// If the workList is empty, we're done!
	// 	if(workList.length == 0) return;

	// 	// Pop a newPos off the end of workList
	// 	var newPos = workList.pop();

	// 	// If it's in our list of already colored pixels, move on to the next one
	// 	if(alreadyColored[newPos])
	// 		processWorkList(workList);
	// 	else {
	// 		// Otherwise, get the x/y coordinates, then color them, and add them to our list of already colored elements
	// 		var currentX = newPos.split(",")[0], currentY = newPos.split(",")[1];
	// 		cx.fillRect(currentX, currentY, 1, 1);
	// 		alreadyColored.push(currentX + "," + currentY);

	// 		// If the non-diagonal, adjacent pixels are the starting color, add them to the workList
	// 		if(px.get(currentX + 1, currentY).equals(startingColor))
	// 			console.log(px.get(currentX - 1, currentY, canvasData, cx).equals(startingColor));
	// 			workList.push(currentX + 1 + "," + currentY);

	// 		if(px.get(currentX - 1, currentY).equals(startingColor))
	// 			workList.push(currentX - 1 + "," + currentY);

	// 		if(px.get(currentX, currentY + 1).equals(startingColor))
	// 			workList.push(currentX + "," + currentY + 1);

	// 		if(px.get(currentX, currentY - 1).equals(startingColor))
	// 			workList.push(currentX + "," + currentY - 1);

	// 		// console.log(workList);
	// 		processWorkList(workList);
	// 	}
	// }

	// processWorkList(workList);


	// DANG IT! This is just too expensive. I hit the maximum call stack pretty quick with this. I'm still proud of my recursive thinking though...
	// function traverse(x, y, canvasData, cx, color) {
	// 	var currentX = x, currentY = y;

	// 	cx.fillRect(currentX, currentY, 1, 1);
	// 	alreadyColored.push(currentX + "," + currentY);

	// 	if(getPixelData(currentX + 1, currentY, canvasData, cx).equals(color) && !alreadyColored[currentX + 1 + "," + currentY])
	// 		traverse(currentX + 1, currentY, canvasData, cx, color);
	// 	else if(getPixelData(currentX - 1, currentY, canvasData, cx).equals(color) && !alreadyColored[currentX - 1 + "," + currentY])
	// 		traverse(currentX - 1, currentY, canvasData, cx, color);
	// 	else if(getPixelData(currentX, currentY + 1, canvasData, cx).equals(color) && !alreadyColored[currentX + "," + currentY + 1])
	// 		traverse(currentX, currentY + 1, canvasData, cx, color);
	// 	else if(getPixelData(currentX, currentY - 1, canvasData, cx).equals(color) && !alreadyColored[currentX + "," + currentY - 1])
	// 		traverse(currentX, currentY - 1, canvasData, cx, color);
	// 	else
	// 		return false;
	// }
	// traverse(thisX, thisY, canvasData, cx, targetColor);
};