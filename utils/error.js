
const error = {
  log: (message, error) => {
    let output = `ERROR: ${message}`;
    if (error) {
      output += `\n${error.stack}`;
    }
    console.error(`\n\n${output}\n\n`);
  }
};

module.exports = error;