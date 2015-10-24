clean:
	@rm -f thr.js

build:
	@browserify index.js -o thr.js
