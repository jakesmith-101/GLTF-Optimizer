# GLTF-Optimzer
A quick opinionated vibe coded script to process GLB files.
## Process
Finds all GLB/GLTF files within input directory. <br />
Removes all cameras and lights, then strips out dead nodes. <br />
After which runs meshoptimizer to compress them. <br />
Then saves to the output directory. <br />
<br />

Requires:
- Download gltfpack.exe from [meshoptimizer](https://github.com/zeux/meshoptimizer)
- Put gltfpack.exe in this folder.
- Install node packages, then:
<br />

`node stripAllGLB.js "input/directory/path" "output/directory/path"`
