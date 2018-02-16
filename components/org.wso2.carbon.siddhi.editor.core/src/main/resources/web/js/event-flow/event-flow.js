/**
 * Copyright (c) 2018, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
define(['require', 'log', 'lodash', 'jquery', 'alerts', 'd3', 'dagre_d3'],
    function (require, log, _, $, alerts, d3, dagreD3) {

        var EventFlow = function (designView) {
            this.$designView = designView;
            this.$siddhiAppName = designView.find('.siddhi-app-name');
            this.$siddhiAppDescription = designView.find('.siddhi-app-description');
            this.$graphView = designView.find('.graph-container');
            this.$siddhiGraph = designView.find('.siddhi-graph');
            this.url = window.location.protocol + "//" + window.location.host + "/editor/event-flow";
        };

        EventFlow.prototype.fetchJSON = function (siddhiCode) {
            var self = this;
            var result = {};

            if (siddhiCode === null || siddhiCode === undefined || siddhiCode === "") {
                result = {status: "fail", errorMessage: "The Siddhi App Cannot Be Empty"};
            } else {
                fetch(siddhiCode);
            }

            function fetch(code) {
                $.ajax({
                    type: "POST",
                    url: self.url,
                    data: window.btoa(code),
                    async: false,
                    success: function (response) {
                        result = {status: "success", responseJSON: response};
                    },
                    error: function (error) {
                        if (error.status === 400) {
                            result = {status: "fail", errorMessage: "Siddhi App Contains Errors"};
                            log.error(error.responseText);
                        } else {
                            result = {status: "fail", errorMessage: "Internal Error Occurred"};
                        }
                    }
                });
            }

            return result;
        };

        EventFlow.prototype.render = function (data) {

            var self = this;

            if (data !== null || data !== undefined || data !== {}) {
                createGraph();
            } else {
                this.alert("Data Not Available");
            }

            function createGraph() {
                var graph = new dagreD3.graphlib.Graph({compound: true}).setGraph({});
                graph.graph().rankDir = "LR";

                // Set the nodes of the graph
                data.nodes.forEach(function (value) {
                    var html;
                    var node;

                    var isValid = true;
                    if (value.type === "partition") {
                        html = "<div class='partition' title='" + value.description + "'>" + value.name + "</div>";
                        node = {
                            label: html,
                            labelType: "html",
                            clusterLabelPos: 'top',
                            style: 'fill: #e0e0d1'
                        };
                    } else {
                        html = "<div title = '" + value.description + "'>";
                        switch (value.type) {
                            case "stream":
                                html = html + "<span class='indicator stream-colour'></span>";
                                break;
                            case "table":
                                html = html + "<span class='indicator table-colour'></span>";
                                break;
                            case "window":
                                html = html + "<span class='indicator window-colour'></span>";
                                break;
                            case "trigger":
                                html = html + "<span class='indicator trigger-colour'></span>";
                                break;
                            case "aggregation":
                                html = html + "<span class='indicator aggregation-colour'></span>";
                                break;
                            case "function":
                                html = html + "<span class='indicator function-colour'></span>";
                                break;
                            case "query":
                                html = html + "<span class='indicator query-colour'></span>";
                                break;
                            case "partitionType":
                                html = html + "<span class='indicator partitionType-colour'></span>";
                                break;
                            default:
                                isValid = false;
                                break;
                        }
                        html = html + "<span class='nodeLabel'>" + value.name + "</span>" + "</div>";
                        node = {
                            labelType: "html",
                            label: html,
                            rx: 7,
                            ry: 7,
                            padding: 0
                        };
                    }

                    if (isValid) {
                        graph.setNode(value.id, node);
                    } else {
                        console.error("Error - invalid node type " + value.type + " for " + value.name);
                    }

                });

                // Set the edges of the graph
                data.edges.forEach(function (value) {
                    var edge = {arrowheadStyle: "fill: #bbb"};

                    // NOTE: To make the edges curve, use -- lineInterpolate : "basis"
                    if (value.type === "arrow") {
                        edge.lineInterpolate = "basis";
                    } else if (value.type === "dotted-line") {
                        // edge.style = "stroke-dasharray: 5, 5; fill:#333;";
                        edge.style = "stroke-dasharray: 5, 5;";
                    } else {
                        console.error("Error - invalid edge type: " + value.type + " (Parent = " + value.parent + ", Child = " + value.child + ")");
                    }

                    // Set the edge
                    graph.setEdge(value.parent, value.child, edge);
                });

                // Set the groups of the graph
                data.groups.forEach(function (value) {
                    value.children.forEach(function (child) {
                        graph.setParent(child, value.id);
                    });
                });

                if (data.appName !== null || data.appName !== undefined || data.appName !== "") {
                    self.$siddhiAppName.html(data.appName);
                }

                if (data.appDescription !== null || data.appDescription !== undefined || data.appDescription !== "") {
                    self.$siddhiAppDescription.html(data.appDescription);
                }

                var render = new dagreD3.render();

                var graphId = "#" + self.$siddhiGraph.attr("id");

                render(d3.select(graphId + " g"), graph);

                var svg = self.$siddhiGraph;
                var inner = svg.find('g');

                svg.attr("width", inner.get(0).getBoundingClientRect().width + 60);
                svg.attr("height", inner.get(0).getBoundingClientRect().height + 60);


                var graphWidth = parseInt(svg.attr("width"));
                var graphHeight = parseInt(svg.attr("height"));
                var width = self.$graphView.width();
                var height = self.$graphView.height();

                var left = diff(width, graphWidth) / 2;
                var top = diff(height, graphHeight) / 2;
                svg.attr("transform", "translate(" + left + "," + top + ")");

                function diff(divValue, graphValue) {
                    if (divValue > graphValue) {
                        return (divValue - graphValue);
                    } else {
                        return 0;
                    }
                }


                /*-------------------UNCOMMENT TO ADD ZOOM & CENTERING------------------------------------*/
                // var svg = d3.select(graphId);
                // var inner = svg.select("g");
                // var zoom = d3.behavior.zoom().on("zoom", function () {
                //     inner.attr("transform", "translate(" + d3.event.translate + ")" +
                //         "scale(" + d3.event.scale + ")");
                // });
                //
                // svg.call(zoom);
                //
                // // Obtian the graph width and height
                // var graphWidth = graph.graph().width;
                // var graphHeight = graph.graph().height;
                //
                // // Obtain the original height of the container
                // var width = parseInt(svg.style("width").replace(/px/, ""));
                // var height = parseInt(svg.style("height").replace(/px/, ""));
                //
                // // Calculate the scale to zoom
                // var zoomScale = Math.min((width * 0.75) / graphWidth, (height * 0.75) / graphHeight);
                //
                // // recalculate the graph width & height assuming the zoom was implemented onto it
                // graphWidth = graph.graph().width * zoomScale;
                // graphHeight = graph.graph().height * zoomScale;
                //
                // // calculate the translate values  needed to center the graph
                // var left = (width - graphWidth) / 2;
                // var top = (height - graphHeight) / 2;
                // var translate = [left, top];
                //
                // // apply the translate & zoom
                // zoom.translate(translate);
                // zoom.scale(zoomScale);
                //
                // // Make sure the zoom and translate are done upon render
                // zoom.event(inner);

            }
        };

        EventFlow.prototype.clear = function () {
            this.$designView.find('svg').empty();
            this.$designView.find('svg').html('<g></g>');
        };

        EventFlow.prototype.alert = function (message) {
            alerts.warn(message);
        };

        return EventFlow;

    });
