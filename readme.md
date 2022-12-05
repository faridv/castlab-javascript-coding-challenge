#castLabs JavaScript Coding Challenge

##Note

The project uses the latest ECMAScript standards; therefore, it only works in modern browsers. Unfortunately, I didn't have access to Internet Explorer 11, but I made sure that the project worked in the latest versions of Chrome, Firefox, and Edge browsers.

If supporting IE11 is mandatory, I can use some tools like Babel to create a compatible JS bundle.

##Usage
For this project, you can open `index.html` in a browser. However, I have used JavaScript's native `fetch` functionality, so it is better to use a web server.

    git clone ggggg
    npx http-server

##Development
You can change the source files and run `npm run build` to create the new JS bundle.

##Bonus 1
*Which problem can occur if the content of the MDAT box is very large?*

First, we are using `console.log` to show the box content. The`console.log` stores a reference to the object, so it can't be garbage collected. So the object stays in the console even after the functions finish their jobs.

Next, we have the limitation of memory usage by the browser. Although the limitation differs in all platforms, it might affect large buffers occupying memory.

##Bonus 2
*The MDAT box contains base64-encoded images. Display those images on the HTML
page.*

I implemented this functionality, and MDAT images are shown on the HTML page.
