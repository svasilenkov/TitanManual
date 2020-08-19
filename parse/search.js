const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const avoParse = require('./avoParse')

async function getFiles(dir) {
  const subdirs = await readdir(dir);
  const files = await Promise.all(subdirs.map(async (subdir) => {
    const res = path.resolve(dir, subdir);
    return (await stat(res)).isDirectory() ? getFiles(res) : res;
  }));
  return files.reduce((a, f) => a.concat(f), []);
}

function getVersions() {
  var versionsFile = JSON.parse(fs.readFileSync(avoParse.paths.versions));

  let versions = [
    {
      path: avoParse.paths.docsDir,
      number: 'next'
    }
  ];

  versionsFile.forEach(function(version) {
    versions.push(
      {
        path: path.join(avoParse.paths.versionedDocsDir, `version-${version}`),
        number: version
      }
    );
  });

  return versions;
}

getVersions().forEach(function(version) {
  getFiles(version.path).then((filenames) => {
    let output = [];
    filenames.forEach(function(filename) {
      if (!filename.includes(".DS_Store")) {
        let content = fs.readFileSync(filename, 'utf-8');
        console.log(filename);
        filename = filename.replace(version.path + path.sep, "");
        let header = "";
        let url = filename.replace(".md", "");
        let section = "";
        let title = content.match(avoParse.regex.yamlBlockTitle)[0];
        let subtitle = "";
        let match;
        while (match = /\n.{1,}\n-{5,}\n\n|^#{1,} (?:.|\/)*/gm.exec(content)) {
          try {
            let section = content.substring(0, match.index);
            output.push({filename, url, content: header + section, title, subtitle});

            header = content.substring(match.index, match.index + match[0].length);
            let headerRegex = header.match(/[A-Za-z \/]{1,}/gm);
            subtitle = headerRegex[0];
            url = header.toLowerCase();
            url = url.replace("/", "-");

            url = url.replace(/[^a-z0-9 -]/g, "");
            url = url.trim();
            url = url.replace(/ /g, "-");
            url = url.replace(/-+/g, "-");
            url = url.replace(/-+$/g, "");

            url = filename.replace(".md", "") + "#" + url;
            content = content.substring(match.index + match[0].length - 1, content.length - 1);
          } catch (ex) {
            console.log(ex);
          }
        }
        output.push({filename, url, content: header + content, title, subtitle});
      }
    });

    fs.writeFile(path.join(avoParse.paths.staticDir, `index-${version.number}.json`), JSON.stringify(output, null, 2), function(err) {
      if(err) {
        return console.log(err);
      }
    });
  });
});
