## Attention: this repo only contains the code of original Boxer. Please visit [here](https://github.com/uwgraphics/BoxerRelease/) for the latest version. 

# Boxer: Interactive Comparison of Classifier Results
Boxer Classifier Comparison System - Public, Open Source Release

Note: this is the Spring 2020 release corresponding to the EuroVis 2020 paper. A new release, with the improved version of the system is coming soon.

This repository contains the Open Source release of the Boxer system for classifier comparison.

You can find more documentation about boxer as well as an online demo at
[https://graphics.cs.wisc.edu/Vis/Boxer](https://graphics.cs.wisc.edu/Vis/Boxer). A user guide is under development.

Note: this repository allows you to clone the source code so you can examine the code, make changes, and host boxer on your own local system. If you simply want to use Boxer, we recommend that you use the online demo at [https://graphics.cs.wisc.edu/Vis/Boxer](https://graphics.cs.wisc.edu/Vis/Boxer). This online system still allows you to load your own data.

The Boxer System is released under an MIT license. If you find Boxer useful, we would love to know.

If you find Boxer useful, please cite the paper:

> Michael Gleicher, Aditya Barve, Xinyu Yu, and Florian Heimerl. Boxer: Interactive Comparison of Classifier Results. *Computer Graphics Forum* 39 (3), June 2020.

We are unable to provide any support for the system. 

This version of Boxer represents the state of the system as of April 2020. This is the system described in the Boxer EuroVis paper. 

## Authors and Acknowledgments

Boxer was developed by Aditya Barve, Xinyi Yu, Florian Heimerl and Michael Gleicher. The Boxer project is led by Prof. [Michael Gleicher](http://pages.cs.wisc.edu/~gleicher/).

Boxer was developed as part of research supported in part by the National Science Foundation under award IIS-1841349 and DARPA award FA8750-17-2-010.

## Requirements
* npm

## Usage

See the [Boxer web page](https://graphics.cs.wisc.edu/Vis/Boxer) for instructions on how to use Boxer.

This repository contains two components: the **client** which is the Boxer application that runs in browser, and a **server** which is an npm application that serves the sample data to the client. The interesting part is the client.

### Server

Start the server:
```shell
cd server
npm run serve
```
Server's `npm run serve` should respond with:

    Server created and listening on port 3000

### Client

Start the client as a separate process:
```shell
cd client
npm install
npm run serve
```
Client's `npm run serve` should respond with:

    App running at:
    - Local:   http://localhost:port/
    - Network: http://ip-address:port/

Open the `Local` link in a web browser.

## Add your own dataset
[data preparation](<https://graphics.cs.wisc.edu/Vis/Boxer/docs/data_preparation/>)


