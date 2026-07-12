# Authenticator Enhanced <img align="right" width="100" height="100" src="images/icon.svg">

> Authenticator generates 2-Step Verification codes in your browser.

This is an actively maintained continuation of [Authenticator-Extension/Authenticator](https://github.com/Authenticator-Extension/Authenticator), which has been unmaintained since October 2024 (280+ open issues, dozens of unreviewed pull requests). This fork picks up outstanding bug fixes and ongoing maintenance. All credit for the original design and implementation goes to the upstream project and its contributors.

Not yet published to any extension store — build from source below.

## Build Setup

``` bash
# install development dependencies
npm install
# compile
npm run [chrome, firefox, prod]
```

To reproduce a build:

``` bash
npm ci
npm run prod
```

## Development (Chrome)

``` bash
# install development dependencies
npm install
# compiles the Chrome extension to the `./test/chrome` directory
npm run dev:chrome
# load the unpacked extension from the `./test/chrome/ directory in Chrome
```

Note that Windows users should download a tool like [Git Bash](https://git-scm.com/download/win) or [Cygwin](http://cygwin.com/) to build.
