$(function() {
	var FADE_DELAY_MS = 0,
		EXTRA_DELAY = 80,
		SHOW_NAME_DELAY = 50,
		MIN_LIST_LENGTH = 60,
		MAX_LIST_LENGTH = 300;

	var NameEntryModel = Backbone.Model.extend({
		defaults: {
			name: ''
		},

		remove: function() {
			this.destroy();
		}
	});

	var NameEntryView = Backbone.View.extend({
		tagName: 'li',
		template: _.template($('#name-entry-template').html()),

		events: {
			'click .remove' : 'remove'
		},

		render: function() {
			this.$el.html(this.template(this.model.toJSON()));
			return this;
		},

		remove: function(){
			this.model.remove();
			this.$el.remove();
		}
	});

	var NameWinnerView = Backbone.View.extend({
		className: 'winner',
		template: _.template($('#name-winner-template').html()),

		events: {
			'click .remove' : 'remove'
		},

		render: function(){
			this.$el.html(this.template(this.model.toJSON()));
			return this;
		},

		remove: function(){
			confetti.stop();
			this.model.remove();
			this.$el.remove();
			$("#blanket").remove();
			$("#selecting-name").removeClass("final-winner")
								.html("<div id='pick-another'>draw again...</div>")
		}
	});

	var NameEntryCollection = Backbone.Collection.extend({
		model: NameEntryModel,
		localStorage: new Store('name-entry-list'),
		all: function() {
			return this.filter(function(){
				return true;
			})
		}
	});

	var Entries = new NameEntryCollection;

	var App = Backbone.View.extend({
		el: $('#outer-container'),

		events: {
			'keypress #name-input' : 'createEntry',
			'click #file-trigger' : 'showHideFileUpload',
			'change #file-input' : 'showFileSample',
			'click #file-submit' : 'createEntriesFromFile',
			'click #pick-winner' : 'pickWinner',
			'click #pick-another' : 'pickWinner',
			'click #clear-all-safety' : 'clearAllSafety',
			'click #clear-all' : 'clearAll'
		},

		initialize: function(){
			this.input = this.$('#name-input');

			Entries.bind('add', this.addEntry, this);
			Entries.bind('reset', this.addAll, this);
			Entries.bind('all', this.render, this);

			Entries.fetch();
		},

		showHideFileUpload: function(){
			$("#file-area").toggle("visible");
		},

		showFileSample: function(e) {
			if (window.File && window.FileReader) {
				var file = e.target.files[0]; //only one file
				$("#file-sample").text("type: " + file.type);
				var reader = new FileReader();
				reader.onload = (function(file){
					return function(e) {
						var contents = e.target.result || "";
						// assumed separators: newline comma pipe
						var result = contents.split(/,|\||\r\n|\r|\n/g);
						// remove any empty cases
						result = _.reject(result, function(val){return val === ""});
						$("#file-sample").data("contents", result.join(","));
						$("#file-sample").text("");
						$("#file-sample").append("Sample of file contents:<br/>");
						_.each(_.first(result, 10), function(val) {
							$("#file-sample").append(_.escape(val) + "<br/>");
						});
						$("#file-sample").append("...etc...");
						return result;
					}
				})(file);
				reader.readAsText(file);
			} else {
				$("#file-sample").text("Your browser doesn't support file reading. Try using Chrome?")
				$("#file-submitd").attr("disabled", true);
			}
		},

		createEntriesFromFile: function() {
			var values = $("#file-sample").data("contents") || "";
			_.each(values.split(","), function(val) {
				Entries.create({name: val});
			});
			$("#file-input").val("");
			$("#file-sample").text("");
		},

		createEntry: function(e){
			if (e.which !== 13) return;
			var inputValue = this.input.val().trim();

			if (!inputValue) return;

			Entries.create({name: inputValue});
			this.input.val('');
		},

		addEntry: function(nameEntry){
			var view = new NameEntryView({model: nameEntry}),
			    entryListLength = Entries.length,
			    nameListClass;

			if (entryListLength !== 0) {
				var indexOfEntry = _.indexOf(Entries.models, nameEntry);
				nameListClass = (indexOfEntry % 2 === 0) ? '.name-list.left' : '.name-list.right';
			} else {
				nameListClass = (Entries.length % 2 === 0) ? '.name-list.right' : '.name-list.left';
			}
			this.$(nameListClass).prepend(view.render().el);
		},

		addAll: function(){
			Entries.each(this.addEntry);
		},

		render: function() {
			$('.num-entries').text(Entries.length + ' entries');
		},

		getEntries: function() {
			return Entries.all();
		},

		getShuffled: function(){
			return _.shuffle(Entries.all());
		},

		getShuffledNames: function(){
			return this.getShuffled().map(function(model){
				return model.get('name');
			});
		},

		buildDecentShuffledList: function(){
			console.log("Shuffle and build list of names");
			var list = this.getShuffledNames();
			if (list.length > MAX_LIST_LENGTH) {
				list = _.sample(list, MAX_LIST_LENGTH);
			}
			while (list.length < MIN_LIST_LENGTH) {
				list = list.concat(this.getShuffledNames());
			}
			console.log("Total list length:" + list.length);
			return list;
		},

		pickWinner: function() {
			var that = this,
				shuffledNames = this.buildDecentShuffledList();

			console.log("Picking winner...");
			if ($("#entry-container").length > 0) {
				$("#entry-container").slideUp(FADE_DELAY_MS, function(){
					$(this).remove();
					$("#winner-container").slideDown(FADE_DELAY_MS, function(){
						$(this).removeClass("hidden");
						that.easingTimeout(that.showNames, shuffledNames, SHOW_NAME_DELAY);
					});
				});
			} else {
				$("#pick-another").fadeOut(FADE_DELAY_MS, function(){
					$(this).remove();
					that.easingTimeout(that.showNames, shuffledNames, SHOW_NAME_DELAY);
				});
			}

		},

		showNames: function(names) {
			$("#selecting-name").text(names[0]);
			return names.slice(1);
		},

		easingTimeout: function(callback, names, delay){
			var that = this;
			var internalCallback = function(names, delay){
				return function(){
					if (names && names.length !== 0) {
						if (names.length === 20) {
							delay += EXTRA_DELAY;
						}
						if (names.length < 10) {
							delay += 50;
						}
						names = callback(names);
						setTimeout(internalCallback, delay);
					} else {
						var selectedWinner = $("#selecting-name").text().trim(),
							winner = Entries.where({name: selectedWinner})[0],
							winnerView = new NameWinnerView({model: winner});
						console.log("Winner is: " + selectedWinner);
						confetti.start();
						$("#selecting-name").html(winnerView.render().el);
						setTimeout(function(){
							$("#selecting-name").addClass("final-winner");
							$("body").append("<div id='blanket'></div>");
						}, 100);
					}
				}
			}(names, delay);

			setTimeout(internalCallback, 0);
		},

		clearAllSafety: function() {
			this.$el.append("<div id='clear-all' class='hidden-trigger'>CLEAR ALL</div>");
			setTimeout(function(){
				$("#clear-all").remove();
			}, 3000);
		},

		clearAll: function() {
			_.each(Entries.all(), function(entry){
				entry.remove();
			})
			$(".name-list").empty();
			$("#clear-all").remove();
			return false;
		}
	});

	MyApp = new App;
});
