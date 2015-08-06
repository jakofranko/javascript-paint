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

tools["Pick color"] = function(event, cx) {
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