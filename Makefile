clean:
	@rm -f thr.js

build:
	@./node_modules/.bin/browserify -g uglifyify index.js -o thr.js
