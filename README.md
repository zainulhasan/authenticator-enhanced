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

## Acknowledgment

We would like to extend our heartfelt thanks to Laurent, the Chief Information Security Officer (CISO) of the University of Luxembourg, for the invaluable support and contribution to this project. During the development process, the CISO team provided critical security recommendations that helped us identify and address potential vulnerabilities, significantly enhancing the security and reliability of the project.

We especially want to acknowledge the University of Luxembourg’s information security team for their selfless contribution, which not only facilitated the progress of this project but also had a positive impact on the broader open-source community. We recognize that the success of open-source software depends heavily on collaboration and support from various stakeholders, and the involvement of the University of Luxembourg has allowed us to offer a more secure and dependable product to a wider audience.

We understand that while open-source software is free, maintaining and improving these projects requires significant resources. The University of Luxembourg’s information security team has demonstrated their strong commitment to the open-source community, contributing not just within their university but to users and developers globally. We hope this acknowledgment will help them continue to secure the support and resources necessary to further advance open-source initiatives.

Once again, we express our sincere gratitude to the University of Luxembourg’s CISO team for their valuable advice and assistance.
