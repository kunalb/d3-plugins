d3.sankey = function() {
  var sankey = {},
      nodeWidth = 24,
      nodePadding = 8,
      size = [1, 1],
      nodes = [],
      links = [],
      components = [];

  sankey.nodeWidth = function(_) {
    if (!arguments.length) return nodeWidth;
    nodeWidth = +_;
    return sankey;
  };

  sankey.nodePadding = function(_) {
    if (!arguments.length) return nodePadding;
    nodePadding = +_;
    return sankey;
  };

  sankey.nodes = function(_) {
    if (!arguments.length) return nodes;
    nodes = _;
    return sankey;
  };

  sankey.links = function(_) {
    if (!arguments.length) return links;
    links = _;
    return sankey;
  };

  sankey.size = function(_) {
    if (!arguments.length) return size;
    size = _;
    return sankey;
  };

  sankey.layout = function(iterations) {
    computeNodeLinks();
    computeNodeValues();

    computeNodeStructure();
    computeNodeBreadths();

    computeNodeDepths(iterations);
    computeLinkDepths();
    
    return sankey;
  };

  sankey.relayout = function() {
    computeLinkDepths();
    return sankey;
  };

  sankey.link = function() {
    var curvature = .5;

    function forwardLink(d) {
      var x0 = d.source.x + d.source.dx,
          x1 = d.target.x,
          xi = d3.interpolateNumber(x0, x1),
          x2 = xi(curvature),
          x3 = xi(1 - curvature),
          y0 = d.source.y + d.sy,
          y1 = d.target.y + d.ty,
          y2 = d.source.y + d.sy + d.dy,
          y3 = d.target.y + d.ty + d.dy;
      return "M" + x0 + "," + y0
           + "C" + x2 + "," + y0 + " " + x3 + "," + y1 + " " + x1 + "," + y1
           + "L" + x1 + "," + y3
           + "C" + x3 + "," + y3 + " " + x2 + "," + y2 + " " + x0 + "," + y2
           + "Z";
    }

    function backwardLink(d) {
      var x0 = d.source.x + d.source.dx,
          x1 = d.target.x,
          xi = d3.interpolateNumber(x0, x1),
          x2 = xi(curvature) + x0 - x1,
          x3 = xi(1 - curvature) + x1 - x0,
          y0 = d.source.y + d.sy,
          y1 = d.target.y + d.ty,
          y2 = d.source.y + d.sy + d.dy,
          y3 = d.target.y + d.ty + d.dy;
      return "M" + x0 + "," + y0
           + "C" + x2 + "," + y0 + " " + x3 + "," + y1 + " " + x1 + "," + y1
           + "L" + x1 + "," + y3
           + "C" + x3 + "," + y3 + " " + x2 + "," + y2 + " " + x0 + "," + y2
           + "Z";
    }

    function selfLink(d) {
      var x0 = d.source.x + d.source.dx,
          x1 = d.target.x,
          xi = d3.interpolateNumber(x0, x1),
          x2 = x0 + nodeWidth * 2,
          x3 = x1 - nodeWidth * 2,
          y0 = d.source.y + d.sy,
          y1 = d.target.y + d.ty,
          y2 = d.source.y + d.sy + d.dy,
          y3 = d.target.y + d.ty + d.dy,
          y0_ = y0 + d.dy/2,
          y1_ = y1 + d.dy/2,
          y2_ = y2 + d.dy/2,
          y3_ = y3 + d.dy/2;
      return "M" + x0 + "," + y0
           + "C" + x2 + "," + y0_ + " " + x3 + "," + y1_ + " " + x1 + "," + y1
           + "L" + x1 + "," + y3
           + "C" + x3 + "," + y3_ + " " + x2 + "," + y2_ + " " + x0 + "," + y2
           + "Z";
    }

    function link(d) {
      if (d.source == d.target) {
        return selfLink(d);
      } else if (d.source.x < d.target.x) {
        return forwardLink(d);
      } else {
        return backwardLink(d);
      }
    }

    link.curvature = function(_) {
      if (!arguments.length) return curvature;
      curvature = +_;
      return link;
    };

    return link;
  };

  // Populate the sourceLinks and targetLinks for each node.
  // Also, if the source and target are not objects, assume they are indices.
  function computeNodeLinks() {
    nodes.forEach(function(node) {
      node.sourceLinks = [];
      node.targetLinks = [];
    });

    links.forEach(function(link) {
      var source = link.source,
          target = link.target;
      if (typeof source === "number") source = link.source = nodes[link.source];
      if (typeof target === "number") target = link.target = nodes[link.target];
      source.sourceLinks.push(link);
      target.targetLinks.push(link);
    });
  }

  // Compute the value (size) of each node by summing the associated links.
  function computeNodeValues() {
    nodes.forEach(function(node) {
      node.value = Math.max(
        d3.sum(node.sourceLinks, value),
        d3.sum(node.targetLinks, value)
      );
    });
  }

  // Take the list of nodes and create a DAG of supervertices, each consisting 
  // of a strongly connected component of the graph
  //
  // Based off:
  // http://en.wikipedia.org/wiki/Tarjan's_strongly_connected_components_algorithm
  function computeNodeStructure() {
    var nodeStack = [], 
        index = 0;

    nodes.forEach(function(node) {
      if (!node.index) {
        connect(node);
      }
    });

    function connect(node) {
      node.index = index++;
      node.lowIndex = node.index;
      node.onStack = true;
      nodeStack.push(node);

      if (node.sourceLinks) {
        node.sourceLinks.forEach(function(sourceLink){
          var target = sourceLink.target;
          if (!target.hasOwnProperty('index')) {
            connect(target);
            node.lowIndex = Math.min(node.lowIndex, target.lowIndex);
          } else if (target.onStack) {
            node.lowIndex = Math.min(node.lowIndex, target.index);
          }
        });

        if (node.lowIndex === node.index) {
          var component = [], currentNode;
          do { 
            currentNode = nodeStack.pop()
            currentNode.onStack = false;
            component.push(currentNode);
          } while (currentNode != node);
          components.push({
            root: node,
            scc: component
          });
        }
      }
    }

    components.forEach(function(component, i){
      component.scc.forEach(function(node) {
        node.component = i;
      });
    });
  }

  // Assign the breadth (x-position) for each strongly connected component,
  // followed by assigning breadth within the component.
  function computeNodeBreadths() {
    components.reverse();
    
    components.forEach(function(component){
      if (!component.x) {
        var sourceX = Math.max.apply({}, flatten(flatten(component.scc.map(function(node){
          return node.targetLinks.map(function(link){
            return components[link.source.component].x ? 
              components[link.source.component].x : 0;
          });
        }))));

        bfs(component, Math.max(sourceX, 0), function(component){
          var targets = flatten(flatten(component.scc.map(function(node){
            return node.sourceLinks.map(function(link){
              return link.target;
            });
          })));
          
          return targets.map(function(target){
            return components[target.component];
          });
        });
      }
    });

    components.forEach(function(component, i){
      bfs(component.root, 0, function(node){
        var result = node.sourceLinks
          .filter(function(sourceLink){
            return sourceLink.target.component == components.length - i - 1;
          })
          .map(function(sourceLink){
            return sourceLink.target;
          });
        return result;
      });
    });

    components.reverse();

    var max = 0;
    var componentsByBreadth = d3.nest()
      .key(function(d) { return d.x; })
      .sortKeys(d3.ascending)
      .entries(components)
      .map(function(d) { return d.values; });

    var max = -1, nextMax = -1;
    componentsByBreadth.forEach(function(c){
      c.forEach(function(component){
        component.x = max + 1;
        component.scc.forEach(function(node){
          node.x = component.x + node.x;
          nextMax = Math.max(nextMax, node.x);
        });
      });
      max = nextMax;
    });

    nodes.forEach(function(node) {
      var outgoing = node.sourceLinks
        .filter(function(link) {
          return link.source != link.target;
        });
      if (outgoing == 0) {
        node.x = max + 1;
      }
    });

    scaleNodeBreadths((size[0] - nodeWidth) / (max));

    function flatten(a) {
      return [].concat.apply([], a);
    }

    function bfs(node, sourceX, extractTargets) {
      var queue = [node], currentCount = 1, nextCount = 0;
      var x = sourceX + 1 || 0;

      while(currentCount > 0) {
        var currentNode = queue.shift();
        currentCount--;

        if (!currentNode.hasOwnProperty('x')) {
          currentNode.x = x;
          currentNode.dx = nodeWidth;

          var targets = extractTargets(currentNode);

          queue = queue.concat(targets);
          nextCount += targets.length;
        }


        if (currentCount == 0) { // level change
          x++;
          currentCount = nextCount;
          nextCount = 0;
        }

      }
    }
  }

  function moveSourcesRight() {
    nodes.forEach(function(node) {
      if (!node.targetLinks.length) {
        node.x = d3.min(node.sourceLinks, function(d) { return d.target.x; }) - 1;
      }
    });
  }

  function moveSinksRight(x) {
    nodes.forEach(function(node) {
      if (!node.sourceLinks.length) {
        node.x = x - 1;
      }
    });
  }

  function scaleNodeBreadths(kx) {
    nodes.forEach(function(node) {
      node.x *= kx;
    });
  }

  function computeNodeDepths(iterations) {
    var nodesByBreadth = d3.nest()
        .key(function(d) { return d.x; })
        .sortKeys(d3.ascending)
        .entries(nodes)
        .map(function(d) { return d.values; });

    //
    initializeNodeDepth();
    resolveCollisions();
    for (var alpha = 1; iterations > 0; --iterations) {
      relaxRightToLeft(alpha *= .99);
      resolveCollisions();
      relaxLeftToRight(alpha);
      resolveCollisions();
    }

    function initializeNodeDepth() {
      var ky = d3.min(nodesByBreadth, function(nodes) {
        return (size[1] - (nodes.length - 1) * nodePadding) / d3.sum(nodes, value);
      });

      nodesByBreadth.forEach(function(nodes) {
        nodes.forEach(function(node, i) {
          node.y = i;
          node.dy = node.value * ky;
        });
      });

      links.forEach(function(link) {
        link.dy = link.value * ky;
      });
    }

    function relaxLeftToRight(alpha) {
      nodesByBreadth.forEach(function(nodes, breadth) {
        nodes.forEach(function(node) {
          if (node.targetLinks.length) {
            var y = d3.sum(node.targetLinks, weightedSource) / d3.sum(node.targetLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });

      function weightedSource(link) {
        return center(link.source) * link.value;
      }
    }

    function relaxRightToLeft(alpha) {
      nodesByBreadth.slice().reverse().forEach(function(nodes) {
        nodes.forEach(function(node) {
          if (node.sourceLinks.length) {
            var y = d3.sum(node.sourceLinks, weightedTarget) / d3.sum(node.sourceLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });

      function weightedTarget(link) {
        return center(link.target) * link.value;
      }
    }

    function resolveCollisions() {
      nodesByBreadth.forEach(function(nodes) {
        var node,
            dy,
            y0 = 0,
            n = nodes.length,
            i;

        // Push any overlapping nodes down.
        nodes.sort(ascendingDepth);
        for (i = 0; i < n; ++i) {
          node = nodes[i];
          dy = y0 - node.y;
          if (dy > 0) node.y += dy;
          y0 = node.y + node.dy + nodePadding;
        }

        // If the bottommost node goes outside the bounds, push it back up.
        dy = y0 - nodePadding - size[1];
        if (dy > 0) {
          y0 = node.y -= dy;

          // Push any overlapping nodes back up.
          for (i = n - 2; i >= 0; --i) {
            node = nodes[i];
            dy = node.y + node.dy + nodePadding - y0;
            if (dy > 0) node.y -= dy;
            y0 = node.y;
          }
        }
      });
    }

    function ascendingDepth(a, b) {
      return a.y - b.y;
    }
  }

  function computeLinkDepths() {
    nodes.forEach(function(node) {
      node.sourceLinks.sort(ascendingTargetDepth);
      node.targetLinks.sort(ascendingSourceDepth);
    });
    nodes.forEach(function(node) {
      var sy = 0, ty = 0;
      node.sourceLinks.forEach(function(link) {
        link.sy = sy;
        sy += link.dy;
      });
      node.targetLinks.forEach(function(link) {
        link.ty = ty;
        ty += link.dy;
      });
    });

    function ascendingSourceDepth(a, b) {
      return a.source.y - b.source.y;
    }

    function ascendingTargetDepth(a, b) {
      return a.target.y - b.target.y;
    }
  }

  function center(node) {
    return node.y + node.dy / 2;
  }

  function value(link) {
    return link.value;
  }

  return sankey;
};

module.exports = d3.sankey;
