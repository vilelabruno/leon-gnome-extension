/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */

/*In this example we will be click a button in the top bar,
  causing an event that create a text label (hello world), which with some
  animation, will be decreasing its opacity from 100% to 0%
 */


/*Import St because is the library that allow you to create UI elements*/
const Gio = imports.gi.Gio;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const St = imports.gi.St;
/*
  Import Main because is the instance of the class that have all the UI elements
  and we have to add to the Main instance our UI elements
  */
const Main = imports.ui.main;
/*Import tweener to do the animations of the UI elements*/
const Tweener = imports.ui.tweener;

/*Global variables for use as button to click (button) and a text label.*/
let text, button;

/*
  Function to call when the label is opacity 0%, as the label remains as a
  UI element, but not visible, we have to delete it explicitily. So since
  the label reaches 0% of opacity we remove it from Main instance.
 */
function _hideHello() {
    Main.uiGroup.remove_actor(text);
    text = null;
}

function _showHello() {
    /*if text not already present, we create a new UI element, using ST library, that allows us
      to create UI elements of gnome-shell.
      REFERENCE: http://developer.gnome.org/st/stable/
     */

    //connection();

    if (!text) {
        text = new St.Label({ style_class: 'helloworld-label', text: "Hello, world!" });
        Main.uiGroup.add_actor(text);
    }

    text.opacity = 255;

    /*
      we have to choose the monitor we want to display the hello world label. Since in gnome-shell
      always has a primary monitor, we use it(the main monitor)
     */
    let monitor = Main.layoutManager.primaryMonitor;

    /*
     we change the position of the text to the center of the monitor.
     */
    text.set_position(Math.floor(monitor.width / 2 - text.width / 2),
        Math.floor(monitor.height / 2 - text.height / 2));

    /*And using tweener for the animations, we indicate to tweener that we want
      to go to opacity 0%, in 2 seconds, with the type of transition easeOutQuad, and,
      when this animation has completed, we execute our function _hideHello.
      REFERENCE: http://hosted.zeh.com.br/tweener/docs/en-us/
     */
    Tweener.addTween(text,
        {
            opacity: 0,
            time: 2,
            transition: 'easeOutQuad',
            onComplete: _hideHello
        });
}

function connection(socket) {
    return new Promise((resolve) => {
        log.title('Client')
        log.success('Connected')

        // Init
        socket.on('init', async (data) => {
            log.info(`Type: ${data}`)
            log.info(`Socket id: ${socket.id}`)

            if (data === 'hotword-node') {
                // Hotword triggered
                socket.on('hotword-detected', (data) => {
                    log.title('Socket')
                    log.success(`Hotword ${data.hotword} detected`)

                    socket.broadcast.emit('enable-record')
                })
            } else {
                const brain = new Brain(socket, langs[process.env.LEON_LANG].short)
                const nlu = new Nlu(brain)
                const asr = new Asr()
                let sttState = 'disabled'
                let ttsState = 'disabled'

                if (process.env.LEON_STT === 'true') {
                    sttState = 'enabled'

                    stt = new Stt(socket, process.env.LEON_STT_PROVIDER)
                    stt.init()
                }
                if (process.env.LEON_TTS === 'true') {
                    ttsState = 'enabled'
                }

                log.title('Initialization')
                log.success(`STT ${sttState}`)
                log.success(`TTS ${ttsState}`)

                // Train modules expressions
                try {
                    await nlu.loadModel(`${__dirname}/../data/expressions/classifier.json`)
                } catch (e) {
                    log[e.type](e.obj.message)
                }

                // Listen for new query
                socket.on('query', async (data) => {
                    log.title('Socket')
                    log.info(`${data.client} emitted: ${data.value}`)

                    socket.emit('is-typing', true)
                    await nlu.process(data.value)
                })

                // Handle automatic speech recognition
                socket.on('recognize', async (data) => {
                    try {
                        await asr.run(data, stt)
                    } catch (e) {
                        log[e.type](e.obj.message)
                    }
                })
            }

            resolve()
        })
    })
}

/*This is the init function, here we have to put our code to initialize our extension.
 we have to be careful with init(), enable() and disable() and do the right things here.
 REFERENCE: http://blog.mecheye.net/2012/02/requirements-and-tips-for-getting-your-gnome-shell-extension-approved/
 */
function init() {
    /*
      We create a button for the top panel. We pass to the constructor a map of properties, properties from St.bin and its
      parent classes, like stWidget. So we declare this properties: a style class(from css theming of gnome shell), we made it reactive
      so the button respond for the mouse clicks, we made it that can focus, so marks the button as being able to receive keyboard focus
      via keyboard navigation, we made the button to fill the x space, and we don't want to fill the y space, so we set the values trues and false respectively
      and we want that the button be reactive to the hover of the mouse, so we set the value of the track_hover property to true.
     */
    button = new St.Bin({
        style_class: 'panel-button',
        reactive: true,
        can_focus: true,
        x_fill: true,
        y_fill: false,
        track_hover: true
    });
    /*
      We create an icon with the system-status-icon icon and give it the name "system-run"
     */
    let icon = new St.Icon({
        icon_name: 'logo',
        style_class: 'leon-logo'
    });
    /*
      we put as a child of the button the icon, so, in the structure of actors we have the icon inside the button that is a
      container.
     */
    button.set_child(icon);
    /*
      we connect the actor signal "button-press-event" from the button to the funcion _showHello. In this manner,
      when we press the button, this signal is emitted, and we captured it and execute the _showHello function.
      You can see all signals in the clutter reference(because we are using St that implements actors from clutter, and
      this signals comes from the actor class): http://developer.gnome.org/clutter/stable/ClutterActor.html#ClutterActor.signals
     */
    button.connect('button-press-event', _showHello);
}

/*
  We have to write here our main extension code and the things that actually make works the extension(Add ui elements, signals, etc).
 */
function enable() {
    /*
      We add the button we created before to the rigth panel of the top panel (where the sound and wifi settings are)
     */
    Main.panel._rightBox.insert_child_at_index(button, 0);
}

/*We have to delete all conections and things from our extensions, to let the system how it is before our extension. So
 We have to unconnect the signals we connect, we have to delete all UI elements we created, etc.
 */
function disable() {
    /*
     we remove the button from the right panel
     */
    Main.panel._rightBox.remove_child(button);
}
