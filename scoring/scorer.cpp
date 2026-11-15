#include <algorithm>
#include <array>
#include <cmath>
#include <iostream>
#include <vector>

struct Point { double lat, lon; };
struct Signal { Point p; int kind, value; };
double metres(Point a, Point b) {
    const double rad = std::acos(-1.0) / 180;
    return 6371000 * rad * std::hypot(b.lat-a.lat, (b.lon-a.lon)*std::cos((a.lat+b.lat)*rad/2));
}

#include <string>
#include "choose.hpp"
int main(int argc,char** argv) {
    if(argc==2 && std::string(argv[1])=="choose") return chooseRoute();
    Point feedback{}; bool hasFeedback=false;
    std::array<double,4> weights{};
    double nightLight, nightActivity, nightRisk;
    int night, count, observations;
    for (double &w : weights) if (!(std::cin >> w) || w <= 0) return 1;
    if (!(std::cin >> nightLight >> nightActivity >> nightRisk >> night >> count >> observations)
        || count < 2 || observations < 0) return 1;
    if (night) { weights[0] *= nightLight; weights[1] *= nightActivity; }
    std::vector<Point> route(count);
    std::vector<Signal> signals(observations);
    for (auto &p : route) if (!(std::cin >> p.lat >> p.lon)) return 1;
    for (auto &s : signals) if (!(std::cin >> s.p.lat >> s.p.lon >> s.kind >> s.value)
        || s.kind < 0 || s.kind > 3 || (s.value != 0 && s.value != 1)) return 1;
    std::vector<double> ends{0};
    for (int i=1; i<count; ++i) ends.push_back(ends.back()+metres(route[i-1],route[i]));
    const double length = ends.back();
    double covered = 0, riskSum = 0;
    std::array<double,4> confidenceLengths{}, factorCoverage{}, adverseCoverage{};
    std::vector<int> segmentLevels;
    size_t edge = 1;
    // Use the midpoint of each 40 m stretch; weight the short final stretch by its length.
    for (double start=0; start<length; start+=40) {
        double span = std::min(40.0,length-start), mid = start+span/2;
        while (edge+1 < ends.size() && ends[edge] <= mid) ++edge;
        double t = (mid-ends[edge-1])/(ends[edge]-ends[edge-1]);
        Point a=route[edge-1], b=route[edge];
        Point p{a.lat+t*(b.lat-a.lat),a.lon+t*(b.lon-a.lon)};
        std::array<int,4> observed{};
        for (const auto &s : signals) {
            if (metres(p,s.p) <= (s.kind==0 ? 30 : 50))
                observed[s.kind] |= 1 << s.value;
        }
        // Any verified open venue supplies activity, even if another venue is closed.
        if (observed[1]==3) observed[1]=1;
        int higher=0, lower=0;
        double sum=0, denom=0;
        for (int k=0;k<4;++k) {
            if (observed[k]!=1 && observed[k]!=2) continue;
            const bool adverse=observed[k]==2;
            higher+=adverse; lower+=!adverse;
            factorCoverage[k]+=span;
            if (adverse) adverseCoverage[k]+=span;
            denom+=weights[k]; if (adverse) sum+=weights[k];
        }
        int level=std::min(3,std::max(higher,lower));
        double localRisk=denom>0 ? 100*sum/denom*(night?nightRisk:1.0) : -1;
        if (!hasFeedback && (level<=1 || (localRisk>=45 && localRisk<=55))) {feedback=p;hasFeedback=true;}
        confidenceLengths[level]+=span;
        segmentLevels.push_back(level);
        if (denom>0) {
            covered+=span;
            riskSum+=span*std::min(100.0,100*(night?nightRisk:1.0)*sum/denom);
        }
    }
    // A route label requires that level or higher across at least 75% of its length.
    int level=covered>0 ? 1 : 0;
    if (length>0 && confidenceLengths[2]+confidenceLengths[3]>=0.75*length) level=2;
    if (length>0 && confidenceLengths[3]>=0.75*length) level=3;
    std::cout << (covered>0 ? std::lround(riskSum/covered) : -1) << ' ' << level
              << ' ' << (length>0 ? std::lround(100*covered/length) : 0);
    for (double m : factorCoverage) std::cout << ' ' << std::lround(m);
    for (double m : adverseCoverage) std::cout << ' ' << std::lround(m);
    std::cout << '\n';
    for (int level : segmentLevels) std::cout << level;
    std::cout << '\n';
    if(hasFeedback) std::cout << std::fixed << feedback.lat << ' ' << feedback.lon << '\n';
}
